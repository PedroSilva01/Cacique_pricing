import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table, RefreshCw, Edit3, Filter, Store, Users } from 'lucide-react';
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
  const [baseCities, setBaseCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [postos, setPostos] = useState([]);

  const [date, setDate] = useState('');
  const [baseFilter, setBaseFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [postoFilter, setPostoFilter] = useState('all');

  // Estados para controlar opções filtradas
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [filteredPostos, setFilteredPostos] = useState([]);

  const [rows, setRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editingPrices, setEditingPrices] = useState({});

  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    if (!userId) return;

    const fetchLookups = async () => {
      try {
        const [baseRes, supplierRes, groupsRes, postosRes, settingsRes] = await Promise.all([
          supabase.from('base_cities').select('*').eq('user_id', userId).order('name'),
          supabase.from('suppliers').select('*').eq('user_id', userId).order('name'),
          supabase.from('groups').select('*').eq('user_id', userId).order('name'),
          supabase.from('postos').select('*').eq('user_id', userId).order('name'),
          supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
        ]);

        if (baseRes.error) throw baseRes.error;
        if (supplierRes.error) throw supplierRes.error;
        if (groupsRes.error) throw groupsRes.error;
        if (postosRes.error) throw postosRes.error;
        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

        setBaseCities(baseRes.data || []);
        setSuppliers(supplierRes.data || []);
        setGroups(groupsRes.data || []);
        setPostos(postosRes.data || []);
        
        // Inicializa com todos os dados
        setFilteredSuppliers(supplierRes.data || []);
        setFilteredGroups(groupsRes.data || []);
        setFilteredPostos(postosRes.data || []);

        const rawSettings = settingsRes.data?.settings || {};
        const mergedSettings = {
          ...defaultSettings,
          ...rawSettings,
          vehicleTypes: {
            ...(defaultSettings.vehicleTypes || {}),
            ...(rawSettings.vehicleTypes || {}),
          },
          fuelTypes: {
            ...(rawSettings.fuelTypes || {}),
            ...(defaultSettings.fuelTypes || {}),
          },
        };

        setSettings(mergedSettings);
      } catch (err) {
        console.error('Erro ao carregar bases/fornecedores:', err);
        showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
      }
    };

    fetchLookups();
  }, [userId, toast]);

  // Efeito para filtrar fornecedores quando a base muda
  useEffect(() => {
    if (baseFilter === 'all') {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter(supplier => 
        supplier.city_ids && supplier.city_ids.includes(baseFilter)
      );
      setFilteredSuppliers(filtered);
    }
    // Resetar filtros dependentes
    setSupplierFilter('all');
    setGroupFilter('all');
    setPostoFilter('all');
  }, [baseFilter, suppliers]);

  // Efeito para filtrar grupos quando o fornecedor muda
  useEffect(() => {
    if (supplierFilter === 'all') {
      setFilteredGroups(groups);
    } else {
      // Grupos que podem comprar deste fornecedor (base_city_id corresponde à base do fornecedor)
      const supplier = suppliers.find(s => s.id === supplierFilter);
      if (supplier && supplier.city_ids && supplier.city_ids.length > 0) {
        const filtered = groups.filter(group => 
          group.base_city_id && supplier.city_ids.includes(group.base_city_id)
        );
        setFilteredGroups(filtered);
      } else {
        setFilteredGroups([]);
      }
    }
    // Resetar filtros dependentes
    setGroupFilter('all');
    setPostoFilter('all');
  }, [supplierFilter, suppliers, groups]);

  // Efeito para filtrar postos quando o grupo muda
  useEffect(() => {
    if (groupFilter === 'all') {
      setFilteredPostos(postos);
    } else {
      const group = groups.find(g => g.id === groupFilter);
      if (group && group.posto_ids && group.posto_ids.length > 0) {
        const filtered = postos.filter(posto => 
          group.posto_ids.includes(posto.id)
        );
        setFilteredPostos(filtered);
      } else {
        setFilteredPostos([]);
      }
    }
    // Resetar filtro dependente
    setPostoFilter('all');
  }, [groupFilter, groups, postos]);

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
      if (groupFilter !== 'all') {
        query = query.contains('group_ids', [groupFilter]);
      }
      // Nota: posto_ids não existe em daily_prices, os preços são aplicados via grupos

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
      <div className="max-w-7xl mx-auto space-y-6"></div>

      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-orange-600" />
            Filtros de busca
          </CardTitle>
          <CardDescription className="text-base">
            Selecione uma data e, opcionalmente, filtre por base, fornecedor, grupo ou posto para listar os lançamentos.
            <br />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              📋 <strong>Filtros hierárquicos:</strong> Base → Fornecedores → Grupos → Postos
              <br />
              💡 <strong>Nota:</strong> Postos são filtrados através dos grupos (preços se aplicam a todos os postos do grupo selecionado)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="edit-date" className="font-semibold text-slate-700 dark:text-slate-300">Data</Label>
              <DatePicker
                value={date}
                onChange={setDate}
                className="mt-1.5"
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
                disabled={baseFilter !== 'all' && filteredSuppliers.length === 0}
              >
                <SelectTrigger id="edit-supplier" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-orange-500 dark:focus:border-orange-400 shadow-sm h-12 rounded-2xl disabled:opacity-50">
                  <SelectValue placeholder={baseFilter !== 'all' && filteredSuppliers.length === 0 ? "Nenhum fornecedor para esta base" : "Todos os fornecedores"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {filteredSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-group" className="font-semibold text-slate-700 dark:text-slate-300">
                <Users className="w-4 h-4 inline mr-1" />
                Grupo (opcional)
              </Label>
              <Select
                value={groupFilter}
                onValueChange={setGroupFilter}
                disabled={supplierFilter !== 'all' && filteredGroups.length === 0}
              >
                <SelectTrigger id="edit-group" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-400 shadow-sm h-12 rounded-2xl disabled:opacity-50">
                  <SelectValue placeholder={supplierFilter !== 'all' && filteredGroups.length === 0 ? "Nenhum grupo para este fornecedor" : "Todos os grupos"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {filteredGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-posto" className="font-semibold text-slate-700 dark:text-slate-300">
                <Store className="w-4 h-4 inline mr-1" />
                Posto (opcional)
              </Label>
              <Select
                value={postoFilter}
                onValueChange={setPostoFilter}
                disabled={groupFilter !== 'all' && filteredPostos.length === 0}
              >
                <SelectTrigger id="edit-posto" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl disabled:opacity-50">
                  <SelectValue placeholder={groupFilter !== 'all' && filteredPostos.length === 0 ? "Nenhum posto para este grupo" : "Todos os postos"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os postos</SelectItem>
                  {filteredPostos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button 
              type="button" 
              onClick={handleSearch} 
              disabled={loading || !date}
              className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-bold rounded-2xl"
            >
              <RefreshCw className={`w-5 h-5 mr-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Buscando...' : 'Buscar lançamentos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Filter className="w-5 h-5 text-blue-600" />
              Resultados encontrados
            </CardTitle>
            <CardDescription className="text-base">
              Clique em "Editar" para alterar os preços de um lançamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-800 dark:to-indigo-900 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700">
                  <Filter className="w-16 h-16 text-blue-400 dark:text-blue-600 mb-4" />
                  <p className="text-center text-blue-600 dark:text-blue-400 font-semibold text-lg mb-2">
                    Nenhum lançamento encontrado
                  </p>
                  <p className="text-center text-blue-500 dark:text-blue-500 text-sm">
                    Tente ajustar os filtros ou selecionar outra data
                  </p>
                </div>
              ) : (
                rows.map((row) => {
                  const baseName = baseCities.find((b) => b.id === row.base_city_id)?.name || '?';
                  const supplierName = suppliers.find((s) => s.id === row.supplier_id)?.name || '?';
                  const fuelsCount = Object.keys(row.prices || {}).length;
                  const groupsCount = (row.group_ids || []).length;

                  return (
                    <div
                      key={row.id}
                      className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{supplierName}</p>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
                              📍 Base: {baseName}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-medium">
                              👥 {groupsCount} grupo(s)
                            </span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-medium">
                              ⛽ {fuelsCount} combustível(is)
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => startEdit(row)}
                          className="border-2 border-blue-300 hover:text-blue-600 text-black hover:bg-blue-50 dark:border-orange-500 dark:text-orange-400 dark:hover:bg-orange-950/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Edit3 className="w-5 h-5 text-green-600" />
              Edição selecionada
            </CardTitle>
            <CardDescription className="text-base">
              Ajuste os valores e clique em "Salvar" para atualizar o lançamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            {!editingRow ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-800 dark:to-emerald-900 rounded-xl border-2 border-dashed border-green-300 dark:border-green-700">
                <Edit3 className="w-16 h-16 text-green-400 dark:text-green-600 mb-4" />
                <p className="text-center text-green-600 dark:text-green-400 font-semibold text-lg mb-2">
                  Nenhum lançamento selecionado
                </p>
                <p className="text-center text-green-500 dark:text-green-500 text-sm">
                  Escolha um item na lista ao lado para editar
                </p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                    <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">
                      📅 Data
                    </Label>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200">
                      {new Date(editingRow.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                    <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2 block">
                      📍 Base
                    </Label>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{selectedBase?.name || '-'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-800">
                    <Label className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2 block">
                      🏭 Fornecedor
                    </Label>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{selectedSupplier?.name || '-'}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2 block">
                      👥 Grupos
                    </Label>
                    <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{(editingRow.group_ids || []).length} grupo(s)</p>
                  </div>
                </div>

                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4 max-h-[300px] overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-4">
                    💰 Combustíveis e Preços
                  </h3>
                  {Object.entries(editingPrices).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 dark:text-slate-400">Nenhum preço cadastrado neste lançamento.</p>
                    </div>
                  ) : (
                    Object.entries(editingPrices).map(([fuelKey, value]) => (
                      <div key={fuelKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                            ⛽ Combustível
                          </Label>
                          <p className="font-bold text-base text-slate-800 dark:text-slate-200">
                            {settings?.fuelTypes?.[fuelKey]?.name || fuelKey}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                            💵 Preço (R$/L)
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">R$</span>
                            <Input
                              type="number"
                              step="0.0001"
                              value={value ?? ''}
                              onChange={(e) => handlePriceChange(fuelKey, e.target.value)}
                              className="pl-10 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 font-mono text-lg font-semibold rounded-2xl"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingRow(null);
                      setEditingPrices({});
                    }}
                    className="border-2 border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-950/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl px-6 py-3"
                  >
                    ❌ Cancelar
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={!editingRow}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-bold rounded-2xl"
                  >
                    ✅ Salvar alterações
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default PriceEdit;
