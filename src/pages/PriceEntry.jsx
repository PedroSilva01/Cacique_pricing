import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, RefreshCw, Trash2, MapPin, Building } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BrandBadge from '@/components/ui/BrandBadge';
import { defaultSettings } from '@/lib/mockData';

const PriceEntry = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados do sistema
  const [baseCities, setBaseCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [postos, setPostos] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  // Função para pegar data local (não UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Formulário
  const [date, setDate] = useState(getLocalDateString());
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]); // Array de group IDs
  const [prices, setPrices] = useState({});

  // Dados computados
  const currentSupplier = suppliers.find(s => s.id === selectedSupplier);
  const availableProducts = currentSupplier?.available_products || [];
  
  // Calcular postos afetados
  const affectedPostos = postos.filter(p => 
    selectedGroups.some(groupId => (p.group_ids || []).includes(groupId))
  );

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [baseCitiesRes, suppliersRes, groupsRes, postosRes, settingsRes] = await Promise.all([
        supabase.from('base_cities').select('*').eq('user_id', user.id).order('name'),
        supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
        supabase.from('groups').select('*').eq('user_id', user.id).order('name'),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', user.id).order('name'),
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
      ]);

      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (postosRes.error) throw postosRes.error;

      setBaseCities(baseCitiesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setGroups(groupsRes.data || []);
      setPostos(postosRes.data || []);
      setSettings(settingsRes.data?.settings || defaultSettings);

      // Selecionar primeira base como padrão apenas se não houver base selecionada
      if (baseCitiesRes.data?.length > 0) {
        setSelectedBase(prev => prev || baseCitiesRes.data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast({
        title: 'Erro ao carregar dados',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handlePriceChange = (fuel, value) => {
    setPrices(prev => ({ ...prev, [fuel]: parseFloat(value) || 0 }));
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    // Validações
    if (!selectedSupplier) {
      toast({ title: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }

    if (!selectedBase) {
      toast({ title: 'Selecione uma base (cidade de origem)', variant: 'destructive' });
      return;
    }

    if (!date) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({ title: 'Selecione ao menos um grupo de postos', variant: 'destructive' });
      return;
    }

    if (Object.keys(prices).length === 0) {
      toast({ title: 'Preencha ao menos um preço', variant: 'destructive' });
      return;
    }

    setSaving(true);

    try {
      const dataToSave = {
        user_id: user.id,
        supplier_id: selectedSupplier,
        base_city_id: selectedBase,
        date,
        prices,
        group_ids: selectedGroups,
      };

      const { error } = await supabase
        .from('daily_prices')
        .upsert(dataToSave, { 
          onConflict: 'user_id, date, supplier_id, base_city_id' 
        });

      if (error) throw error;

      toast({
        title: '✅ Preços salvos com sucesso!',
        description: `Aplicado a ${affectedPostos.length} posto(s) de ${selectedGroups.length} grupo(s)`,
      });

      // Limpar formulário
      setPrices({});
      setSelectedGroups([]);
    } catch (err) {
      console.error('Erro ao salvar preços:', err);
      toast({
        title: 'Erro ao salvar preços',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setPrices({});
    setSelectedGroups([]);
    setDate(getLocalDateString());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lançamento de Preços</h1>
            <p className="text-muted-foreground">
              Configure preços por fornecedor, base e grupos de postos
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulário Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Lançamento</CardTitle>
              <CardDescription>Selecione o fornecedor, base de origem e data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="base">Base (Cidade de Origem)</Label>
                  <Select value={selectedBase || ''} onValueChange={setSelectedBase}>
                    <SelectTrigger id="base">
                      <SelectValue placeholder="Selecione a base..." />
                    </SelectTrigger>
                    <SelectContent>
                      {baseCities.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="supplier">Fornecedor</Label>
                  <Select value={selectedSupplier || ''} onValueChange={setSelectedSupplier}>
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Grupos */}
          <Card>
            <CardHeader>
              <CardTitle>Grupos de Postos</CardTitle>
              <CardDescription>
                Selecione os grupos. O preço será aplicado automaticamente a <strong>TODOS os postos</strong> de cada grupo selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {groups.length > 0 ? groups.map(group => {
                  const groupPostos = postos.filter(p => (p.group_ids || []).includes(group.id));
                  const isSelected = selectedGroups.includes(group.id);

                  return (
                    <div
                      key={group.id}
                      className={`p-4 border rounded-lg transition-all ${
                        isSelected ? 'bg-primary/5 border-primary' : 'bg-card hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleGroupToggle(group.id)}
                        />
                        <label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Building className="w-4 h-4 text-primary" />
                            <span className="font-semibold">{group.name}</span>
                            <BrandBadge bandeira={group.bandeira} size="xs" />
                            <Badge variant="secondary">{groupPostos.length} posto(s)</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {groupPostos.map(p => p.name).join(', ') || 'Nenhum posto neste grupo'}
                          </p>
                        </label>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum grupo cadastrado. Vá em Configurações para criar grupos.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preços */}
          {selectedSupplier && (
            <Card>
              <CardHeader>
                <CardTitle>Preços (R$/L)</CardTitle>
                <CardDescription>Preencha os preços dos combustíveis disponíveis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {availableProducts.length > 0 ? availableProducts.map(fuelKey => {
                    const fuelInfo = settings.fuelTypes[fuelKey];
                    if (!fuelInfo) return null;

                    return (
                      <div key={fuelKey}>
                        <Label htmlFor={`price-${fuelKey}`}>{fuelInfo.name}</Label>
                        <Input
                          id={`price-${fuelKey}`}
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={prices[fuelKey] || ''}
                          onChange={e => handlePriceChange(fuelKey, e.target.value)}
                        />
                      </div>
                    );
                  }) : (
                    <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
                      Selecione um fornecedor que possui produtos cadastrados
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel Lateral - Resumo */}
        <div className="space-y-6">
          {/* Resumo da Operação */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <p className="font-semibold">{date ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Base</Label>
                <p className="font-semibold">
                  {baseCities.find(c => c.id === selectedBase)?.name || '-'}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <p className="font-semibold">
                  {suppliers.find(s => s.id === selectedSupplier)?.name || '-'}
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Grupos Selecionados</Label>
                <p className="font-semibold">
                  {selectedGroups.length} grupo(s)
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Postos Afetados</Label>
                <p className="font-semibold text-green-600">
                  {affectedPostos.length} posto(s)
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Preços Preenchidos</Label>
                <p className="font-semibold">
                  {Object.keys(prices).length} combustível(is)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Postos que receberão o preço */}
          {affectedPostos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Postos que receberão este preço</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {affectedPostos.map(posto => (
                    <div key={posto.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                      <Building className="w-3 h-3 text-primary" />
                      <span className="flex-1">{posto.name}</span>
                      <span className="text-xs text-muted-foreground">{posto.city?.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Ação */}
          <div className="space-y-2">
            <Button
              onClick={handleSave}
              disabled={saving || !selectedSupplier || !selectedBase || selectedGroups.length === 0 || Object.keys(prices).length === 0}
              className="w-full"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Preços'}
            </Button>

            <Button
              onClick={handleClear}
              variant="outline"
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Formulário
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PriceEntry;
