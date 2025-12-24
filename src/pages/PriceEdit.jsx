import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table, RefreshCw, Edit3, Filter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PriceEdit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [baseCities, setBaseCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [date, setDate] = useState('');
  const [baseFilter, setBaseFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const [rows, setRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editingPrices, setEditingPrices] = useState({});

  useEffect(() => {
    if (!userId) return;

    const fetchLookups = async () => {
      try {
        const [baseRes, supplierRes] = await Promise.all([
          supabase.from('base_cities').select('*').eq('user_id', userId).order('name'),
          supabase.from('suppliers').select('*').eq('user_id', userId).order('name'),
        ]);

        if (baseRes.error) throw baseRes.error;
        if (supplierRes.error) throw supplierRes.error;

        setBaseCities(baseRes.data || []);
        setSuppliers(supplierRes.data || []);
      } catch (err) {
        console.error('Erro ao carregar bases/fornecedores:', err);
        showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
      }
    };

    fetchLookups();
  }, [userId, toast]);

  const handleSearch = async () => {
    if (!userId || !date) {
      toast({ title: 'Selecione uma data para buscar', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('daily_prices')
        .select('id, date, supplier_id, base_city_id, prices, group_ids')
        .eq('user_id', userId)
        .eq('date', date);

      if (baseFilter !== 'all') {
        query = query.eq('base_city_id', baseFilter);
      }
      if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      const { data, error } = await query
        .order('base_city_id', { ascending: true })
        .order('supplier_id', { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error('Erro ao buscar lançamentos:', err);
      showErrorToast(toast, { title: 'Erro ao buscar lançamentos', error: err });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (row) => {
    setEditingRow(row);
    setEditingPrices(row.prices || {});
  };

  const handlePriceChange = (fuelKey, value) => {
    setEditingPrices((prev) => ({ ...prev, [fuelKey]: parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    if (!editingRow) return;

    try {
      const { error } = await supabase
        .from('daily_prices')
        .update({ prices: editingPrices })
        .eq('id', editingRow.id)
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: 'Preços atualizados com sucesso!' });

      setRows((prev) =>
        prev.map((r) => (r.id === editingRow.id ? { ...r, prices: editingPrices } : r)),
      );
      setEditingRow(null);
      setEditingPrices({});
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
      showErrorToast(toast, { title: 'Erro ao salvar edição', error: err });
    }
  };

  const selectedBase = baseCities.find((b) => b.id === editingRow?.base_city_id);
  const selectedSupplier = suppliers.find((s) => s.id === editingRow?.supplier_id);

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
              <Table className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text text-transparent">Edição de Preços</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              Consulte e edite os lançamentos de preços já realizados.
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto space-y-6">

      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-orange-600" />
            Filtros de busca
          </CardTitle>
          <CardDescription className="text-base">
            Selecione uma data e, opcionalmente, filtre por base e fornecedor para listar os lançamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="edit-date" className="font-semibold text-slate-700 dark:text-slate-300">Data</Label>
              <Input
                id="edit-date"
                type="date"
                className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400 shadow-sm h-12 rounded-2xl"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-base" className="font-semibold text-slate-700 dark:text-slate-300">Base (opcional)</Label>
              <Select
                value={baseFilter}
                onValueChange={setBaseFilter}
              >
                <SelectTrigger id="edit-base" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue placeholder="Todas as bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as bases</SelectItem>
                  {baseCities.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-supplier" className="font-semibold text-slate-700 dark:text-slate-300">Fornecedor (opcional)</Label>
              <Select
                value={supplierFilter}
                onValueChange={setSupplierFilter}
              >
                <SelectTrigger id="edit-supplier" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSearch} disabled={loading || !date}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {loading ? 'Buscando...' : 'Buscar lançamentos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultados</CardTitle>
            <CardDescription className="text-xs">
              Clique em "Editar" para alterar os preços de um lançamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto text-xs">
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum lançamento encontrado para os filtros atuais.
              </p>
            ) : (
              rows.map((row) => {
                const baseName = baseCities.find((b) => b.id === row.base_city_id)?.name || '?';
                const supplierName = suppliers.find((s) => s.id === row.supplier_id)?.name || '?';
                const fuelsCount = Object.keys(row.prices || {}).length;
                const groupsCount = (row.group_ids || []).length;

                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-2 p-2 border rounded-md bg-background/70"
                  >
                    <div className="flex-1 space-y-0.5">
                      <p className="font-semibold text-foreground">{supplierName}</p>
                      <p className="text-muted-foreground">Base: {baseName}</p>
                      <p className="text-muted-foreground">
                        {groupsCount} grupo(s) · {fuelsCount} combustível(is)
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => startEdit(row)}
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edição selecionada</CardTitle>
            <CardDescription className="text-xs">
              Ajuste os valores e clique em "Salvar" para atualizar o lançamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {!editingRow ? (
              <p className="text-muted-foreground text-sm">
                Nenhum lançamento selecionado. Escolha um item na lista ao lado.
              </p>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Data</Label>
                    <p className="font-semibold">
                      {new Date(editingRow.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Base</Label>
                    <p className="font-semibold">{selectedBase?.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Fornecedor</Label>
                    <p className="font-semibold">{selectedSupplier?.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Grupos</Label>
                    <p className="font-semibold">{(editingRow.group_ids || []).length} grupo(s)</p>
                  </div>
                </div>

                <div className="border rounded-md p-3 space-y-2 max-h-[260px] overflow-y-auto">
                  {Object.entries(editingPrices).length === 0 ? (
                    <p className="text-muted-foreground">Nenhum preço cadastrado neste lançamento.</p>
                  ) : (
                    Object.entries(editingPrices).map(([fuelKey, value]) => (
                      <div key={fuelKey} className="grid grid-cols-2 gap-2 items-center">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Combustível</Label>
                          <p className="font-semibold break-all">{fuelKey}</p>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Preço (R$/L)</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            value={value ?? ''}
                            onChange={(e) => handlePriceChange(fuelKey, e.target.value)}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRow(null);
                      setEditingPrices({});
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" onClick={handleSave} disabled={!editingRow}>
                    Salvar alterações
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </motion.div>
  );
};

export default PriceEdit;
