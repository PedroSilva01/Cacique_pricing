import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table, RefreshCw, Edit3, Filter, Store, Users, MapPin, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { defaultSettings } from '@/lib/mockData';

const PriceEdit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [postos, setPostos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [baseCities, setBaseCities] = useState([]);

  // CORRIGIDO: Inicializar com data atual para evitar buscar dados do dia anterior
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  });
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedBase, setSelectedBase] = useState('');
  const [groupPostos, setGroupPostos] = useState([]);
  const [postosPrices, setPostosPrices] = useState({});
  const [availableGroups, setAvailableGroups] = useState([]);
  
  const [editingPosto, setEditingPosto] = useState(null);
  const [editingPrices, setEditingPrices] = useState({});

  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    if (!userId) return;

    const fetchLookups = async () => {
      try {
        const [groupsRes, postosRes, suppliersRes, basesRes, settingsRes] = await Promise.all([
          supabase.from('groups').select('*').eq('user_id', userId).order('name'),
          supabase.from('postos').select('*, cities(*)').eq('user_id', userId).order('name'),
          supabase.from('suppliers').select('*').eq('user_id', userId).order('name'),
          supabase.from('base_cities').select('*').eq('user_id', userId).order('name'),
          supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
        ]);

        if (groupsRes.error) throw groupsRes.error;
        if (postosRes.error) throw postosRes.error;
        if (suppliersRes.error) throw suppliersRes.error;
        if (basesRes.error) throw basesRes.error;
        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

        setGroups(groupsRes.data || []);
        setPostos(postosRes.data || []);
        setSuppliers(suppliersRes.data || []);
        setBaseCities(basesRes.data || []);

        const rawSettings = settingsRes.data?.settings || {};
        const mergedSettings = {
          ...defaultSettings,
          ...rawSettings,
          vehicleTypes: {
            ...(defaultSettings.vehicleTypes || {}),
            ...(rawSettings.vehicleTypes || {}),
          },
          fuelTypes: {
            // CORRIGIDO: Primeiro defaultSettings, depois rawSettings para permitir sobrescrita
            ...(defaultSettings.fuelTypes || {}),
            ...(rawSettings.fuelTypes || {}),
          },
        };

        setSettings(mergedSettings);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
      }
    };

    fetchLookups();
  }, [userId, toast]);

  // Quando grupo for selecionado, buscar postos do grupo
  useEffect(() => {
    if (selectedGroup) {
      const group = groups.find(g => g.id === selectedGroup);
      if (group) {
        const groupPostosFiltered = postos.filter(p => 
          (p.group_ids || []).includes(selectedGroup)
        );
        setGroupPostos(groupPostosFiltered);
        
        // Limpar edição quando trocar de grupo
        setEditingPosto(null);
        setEditingPrices({});
      }
    } else {
      setGroupPostos([]);
    }
  }, [selectedGroup, groups, postos]);

  // Reset filtros dependentes quando base mudar
  useEffect(() => {
    if (selectedBase) {
      setSelectedSupplier('');
      setSelectedGroup('');
      setGroupPostos([]);
      setPostosPrices({});
      setEditingPosto(null);
      setEditingPrices({});
    }
  }, [selectedBase]);

  // Reset filtros dependentes quando fornecedor mudar e carregar grupos disponíveis
  useEffect(() => {
    if (selectedSupplier && selectedSupplier !== 'all') {
      setSelectedGroup('');
      setGroupPostos([]);
      setPostosPrices({});
      setEditingPosto(null);
      setEditingPrices({});
      loadAvailableGroups();
    } else {
      setAvailableGroups([]);
    }
  }, [selectedSupplier]);

  const loadAvailableGroups = async () => {
    if (!selectedSupplier || selectedSupplier === 'all' || !selectedBase || selectedBase === 'all') {
      setAvailableGroups([]);
      return;
    }

    try {
      // Buscar grupos que este fornecedor realmente atende baseado em daily_prices
      const { data: supplierGroups, error } = await supabase
        .from('daily_prices')
        .select('group_ids')
        .eq('user_id', userId)
        .eq('supplier_id', selectedSupplier)
        .eq('base_city_id', selectedBase);

      if (error) throw error;

      // Coletar todos os group_ids únicos que este fornecedor atende
      const groupIdsSet = new Set();
      supplierGroups?.forEach(price => {
        price.group_ids?.forEach(groupId => groupIdsSet.add(groupId));
      });

      // CORRIGIDO: Mostrar TODOS os grupos da base, não apenas os que já têm preços
      const allBaseGroups = groups.filter(group => group.base_city_id === selectedBase);
      
      // Marcar quais grupos têm preços salvos (para referência)
      const groupsWithPrices = allBaseGroups.map(group => ({
        ...group,
        hasExistingPrices: groupIdsSet.has(group.id)
      }));

      setAvailableGroups(groupsWithPrices);
    } catch (err) {
      console.error('Erro ao carregar grupos disponíveis:', err);
      setAvailableGroups([]);
    }
  };

  // Quando data e grupo estiverem selecionados, buscar preços atuais
  useEffect(() => {
    if (selectedDate && selectedGroup && groupPostos.length > 0) {
      loadPostosPrices();
    }
  }, [selectedDate, selectedGroup, groupPostos, selectedSupplier]);

  const loadPostosPrices = async () => {
    if (!selectedDate || !selectedGroup || groupPostos.length === 0) return;

    setLoading(true);
    try {
      // Buscar preços individuais dos postos (station_prices)
      const { data: stationPricesData, error: stationError } = await supabase
        .from('station_prices')
        .select('*')
        .eq('user_id', userId)
        .eq('date', selectedDate)
        .in('station_id', groupPostos.map(p => p.id));

      if (stationError) throw stationError;

      // Buscar preços do grupo (daily_prices) para usar como fallback
      const { data: groupPricesData, error: groupError } = await supabase
        .from('daily_prices')
        .select('*')
        .eq('user_id', userId)
        .eq('date', selectedDate)
        .contains('group_ids', [selectedGroup]);

      if (groupError) throw groupError;

      // Organizar preços por posto
      const pricesByPosto = {};
      
      // Primeiro aplicar preços do grupo como fallback
      groupPricesData?.forEach(groupPrice => {
        groupPostos.forEach(posto => {
          if (!pricesByPosto[posto.id]) {
            pricesByPosto[posto.id] = {};
          }
          Object.entries(groupPrice.prices || {}).forEach(([fuel, price]) => {
            pricesByPosto[posto.id][fuel] = price;
          });
        });
      });

      // Depois sobrescrever com preços individuais se existirem
      stationPricesData?.forEach(stationPrice => {
        if (!pricesByPosto[stationPrice.station_id]) {
          pricesByPosto[stationPrice.station_id] = {};
        }
        Object.entries(stationPrice.prices || {}).forEach(([fuel, price]) => {
          pricesByPosto[stationPrice.station_id][fuel] = price;
        });
      });

      setPostosPrices(pricesByPosto);
    } catch (err) {
      console.error('Erro ao carregar preços:', err);
      showErrorToast(toast, { title: 'Erro ao carregar preços', error: err });
    } finally {
      setLoading(false);
    }
  };

  const startEditPosto = (posto) => {
    setEditingPosto(posto);
    setEditingPrices(postosPrices[posto.id] || {});
  };

  const handlePriceChange = (fuelKey, value) => {
    setEditingPrices((prev) => ({ ...prev, [fuelKey]: parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    if (!editingPosto) return;

    try {
      // Verificar se já existe um registro de station_prices para este posto/data
      const { data: existingData, error: checkError } = await supabase
        .from('station_prices')
        .select('id')
        .eq('user_id', userId)
        .eq('date', selectedDate)
        .eq('station_id', editingPosto.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      let error;
      if (existingData) {
        // Atualizar registro existente
        const updateResult = await supabase
          .from('station_prices')
          .update({ prices: editingPrices })
          .eq('id', existingData.id);
        error = updateResult.error;
      } else {
        // Criar novo registro
        const insertResult = await supabase
          .from('station_prices')
          .insert({
            user_id: userId,
            date: selectedDate,
            station_id: editingPosto.id,
            prices: editingPrices
          });
        error = insertResult.error;
      }

      if (error) throw error;

      toast({ title: 'Preços do posto atualizados com sucesso!' });

      // Atualizar estado local
      setPostosPrices(prev => ({
        ...prev,
        [editingPosto.id]: editingPrices
      }));

      setEditingPosto(null);
      setEditingPrices({});
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
      showErrorToast(toast, { title: 'Erro ao salvar edição', error: err });
    }
  };

  const selectedGroupData = groups.find(g => g.id === selectedGroup);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 rounded-2xl shadow-2xl">
              <Edit3 className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text text-transparent">Correção de Preços</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              Edite preços de postos individuais que estão fora do padrão do grupo.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="shadow-md hover:shadow-lg transition-all rounded-xl"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Seleção de Grupo e Data */}
        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-5 h-5 text-purple-600" />
              Seleção de Grupo
            </CardTitle>
            <CardDescription className="text-base">
              Escolha o grupo e a data para editar preços de postos específicos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <Label htmlFor="edit-date" className="font-semibold text-slate-700 dark:text-slate-300">Data</Label>
                <DatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-base" className="font-semibold text-slate-700 dark:text-slate-300">Base</Label>
                <Select
                  value={selectedBase}
                  onValueChange={setSelectedBase}
                >
                  <SelectTrigger id="edit-base" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl">
                    <SelectValue placeholder="Selecione uma base..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as bases</SelectItem>
                    {baseCities.map((base) => (
                      <SelectItem key={base.id} value={base.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {base.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-supplier" className="font-semibold text-slate-700 dark:text-slate-300">🏭 Fornecedor</Label>
                <Select
                  value={selectedSupplier}
                  onValueChange={setSelectedSupplier}
                  disabled={!selectedBase || selectedBase === "all"}
                >
                  <SelectTrigger id="edit-supplier" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl disabled:opacity-50">
                    <SelectValue placeholder={!selectedBase || selectedBase === "all" ? "Selecione uma base primeiro" : "Selecione um fornecedor..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os fornecedores</SelectItem>
                    {suppliers
                      .filter(supplier => selectedBase && selectedBase !== "all" && supplier.city_ids?.includes(selectedBase))
                      .map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            {supplier.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-group" className="font-semibold text-slate-700 dark:text-slate-300">Grupo</Label>
                <Select
                  value={selectedGroup}
                  onValueChange={setSelectedGroup}
                  disabled={!selectedSupplier || selectedSupplier === "all"}
                >
                  <SelectTrigger id="edit-group" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-400 shadow-sm h-12 rounded-2xl disabled:opacity-50">
                    <SelectValue placeholder={!selectedSupplier || selectedSupplier === "all" ? "Selecione um fornecedor primeiro" : "Selecione um grupo..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {g.name}
                          {g.bandeira && (
                            <span className="text-xs text-slate-500">({g.bandeira})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedGroupData && (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Grupo:</span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedGroupData.name}</div>
                  </div>
                  <div>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Postos:</span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{groupPostos.length}</div>
                  </div>
                  <div>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Data:</span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não selecionada'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Postos do Grupo */}
        {selectedGroupData && groupPostos.length > 0 && (
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Store className="w-5 h-5 text-green-600" />
                Postos do Grupo: {selectedGroupData.name}
              </CardTitle>
              <CardDescription className="text-base">
                Clique em "Editar" para corrigir os preços de um posto específico.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {groupPostos.map((posto) => {
                  const postoPrices = postosPrices[posto.id] || {};
                  const fuelsCount = Object.keys(postoPrices).length;
                  const hasCustomPrices = Object.keys(postoPrices).some(fuel => postoPrices[fuel] !== undefined);

                  return (
                    <div
                      key={posto.id}
                      className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">{posto.name}</h3>
                            {hasCustomPrices && (
                              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-medium">
                                Preços individuais
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
                              📍 {posto.cities?.name || 'Cidade não definida'}
                            </span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-medium">
                              ⛽ {fuelsCount} combustível(is) com preço
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startEditPosto(posto)}
                          className="border-2 border-green-300 hover:text-green-600 text-black hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edição de Posto Individual */}
        {editingPosto && (
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Edit3 className="w-5 h-5 text-amber-600" />
                Editando Posto: {editingPosto.name}
              </CardTitle>
              <CardDescription className="text-base">
                Ajuste os preços deste posto específico. Os valores serão salvos como exceções ao grupo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">
                    Data
                  </Label>
                  <p className="font-bold text-lg text-slate-800 dark:text-slate-200">
                    {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 block">
                    Posto
                  </Label>
                  <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{editingPosto.name}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <Label className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 block">
                    Cidade
                  </Label>
                  <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{editingPosto.cities?.name || '-'}</p>
                </div>
              </div>

              {/* Preços dos combustíveis disponíveis */}
              <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4 max-h-[400px] overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-4">
                  Preços por Combustível
                </h3>
                {Object.keys(settings.fuelTypes || {}).map(fuelKey => {
                  const currentPrice = editingPrices[fuelKey];
                  const groupPrice = postosPrices[editingPosto.id]?.[fuelKey];
                  const hasCustomPrice = currentPrice !== undefined && currentPrice !== groupPrice;
                  
                  return (
                    <div key={fuelKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                          {settings.fuelTypes[fuelKey]?.name || fuelKey}
                        </Label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Preço do grupo: R$ {groupPrice?.toFixed(4) || '0.0000'}
                          {hasCustomPrice && (
                            <span className="ml-2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                              Preço personalizado
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                          Preço (R$/L)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">R$</span>
                          <Input
                            type="number"
                            step="0.0001"
                            value={currentPrice || groupPrice || ''}
                            onChange={(e) => handlePriceChange(fuelKey, e.target.value)}
                            className="pl-10 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 focus:border-amber-500 dark:focus:border-amber-400 shadow-sm h-12 font-mono text-lg font-semibold rounded-2xl"
                            placeholder={`${groupPrice?.toFixed(4) || '0.0000'}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPosto(null);
                    setEditingPrices({});
                  }}
                  className="border-2 border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-950/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl px-6 py-3"
                >
                  Cancelar
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSave} 
                  disabled={!editingPosto}
                  className="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-bold rounded-2xl"
                >
                  Salvar Correções
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
};

export default PriceEdit;
