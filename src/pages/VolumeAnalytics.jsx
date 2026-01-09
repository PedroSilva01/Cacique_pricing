import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Calendar, Filter, DollarSign, Fuel, Building, MapPin, Download, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import BrandBadge from '@/components/ui/BrandBadge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const VolumeAnalytics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [groups, setGroups] = useState([]);
  const [postos, setPostos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState({});

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedDimension, setSelectedDimension] = useState('brand');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Aggregated data
  const [volumeMetrics, setVolumeMetrics] = useState({});
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [topEntities, setTopEntities] = useState([]);
  const [costAnalysis, setCostAnalysis] = useState([]);

  useEffect(() => {
    if (!userId) return;
    fetchData();
    setDateDefaults();
  }, [userId]);

  useEffect(() => {
    if (data.length > 0) {
      processData();
    }
  }, [data, selectedPeriod, selectedDimension, selectedEntity]);

  const setDateDefaults = () => {
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    setStartDate(lastYear.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, groupsRes, postosRes, suppliersRes, settingsRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*, postos(*), groups(*), suppliers(*)')
          .eq('user_id', userId)
          .gte('order_date', startDate || '2020-01-01')
          .lte('order_date', endDate || new Date().toISOString().split('T')[0]),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('postos').select('*, cities(*)').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('settings').eq('user_id', userId).single()
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (postosRes.error) throw postosRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

      setData(ordersRes.data || []);
      setGroups(groupsRes.data || []);
      setPostos(postosRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setSettings(settingsRes.data?.settings || {});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (date) => {
    const d = new Date(date);
    switch (selectedPeriod) {
      case 'day':
        return d.toLocaleDateString('pt-BR');
      case 'week':
        const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
        return `Sem ${Math.ceil((d.getDate()) / 7)}`;
      case 'month':
        return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      case 'quarter':
        return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
      case 'year':
        return d.getFullYear().toString();
      default:
        return d.toLocaleDateString('pt-BR');
    }
  };

  const getPeriodKey = (date) => {
    const d = new Date(date);
    switch (selectedPeriod) {
      case 'day':
        return date;
      case 'week':
        const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      case 'quarter':
        return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      case 'year':
        return d.getFullYear().toString();
      default:
        return date;
    }
  };

  const getEntityKey = (order) => {
    switch (selectedDimension) {
      case 'brand':
        return order.postos?.bandeira || 'bandeira_branca';
      case 'group':
        return order.groups?.id || 'no-group';
      case 'station':
        return order.postos?.id || 'no-station';
      case 'supplier':
        return order.suppliers?.id || 'no-supplier';
      default:
        return 'all';
    }
  };

  const getEntityName = (key) => {
    switch (selectedDimension) {
      case 'brand':
        return key === 'bandeira_branca' ? 'Bandeira Branca' : key;
      case 'group':
        return groups.find(g => g.id === key)?.name || key;
      case 'station':
        return postos.find(p => p.id === key)?.name || key;
      case 'supplier':
        return suppliers.find(s => s.id === key)?.name || key;
      default:
        return key;
    }
  };

  const processData = () => {
    // Filter data based on selected entity
    const filteredData = selectedEntity === 'all' 
      ? data 
      : data.filter(order => getEntityKey(order) === selectedEntity);

    // Aggregate by period and entity
    const aggregated = {};
    
    filteredData.forEach(order => {
      const periodKey = getPeriodKey(order.order_date);
      const entityKey = getEntityKey(order);
      
      if (!aggregated[periodKey]) {
        aggregated[periodKey] = {};
      }
      
      if (!aggregated[periodKey][entityKey]) {
        aggregated[periodKey][entityKey] = {
          volume: 0,
          totalCost: 0,
          orders: 0,
          financialCost: 0
        };
      }
      
      aggregated[periodKey][entityKey].volume += order.volume || 0;
      aggregated[periodKey][entityKey].totalCost += order.total_cost || 0;
      aggregated[periodKey][entityKey].orders += 1;
      aggregated[periodKey][entityKey].financialCost += order.daily_financial_cost || 0;
    });

    // Convert to time series data
    const seriesData = Object.entries(aggregated).map(([period, entities]) => {
      const total = Object.values(entities).reduce((acc, e) => ({
        volume: acc.volume + e.volume,
        totalCost: acc.totalCost + e.totalCost,
        orders: acc.orders + e.orders,
        financialCost: acc.financialCost + e.financialCost
      }), { volume: 0, totalCost: 0, orders: 0, financialCost: 0 });
      
      return {
        period: getPeriodLabel(period),
        volume: Number(total.volume.toFixed(2)),
        avgPrice: total.volume > 0 ? Number((total.totalCost / (total.volume * 1000)).toFixed(4)) : 0,
        orders: total.orders,
        financialCost: Number(total.financialCost.toFixed(2))
      };
    }).sort((a, b) => a.period.localeCompare(b.period));

    setTimeSeriesData(seriesData);

    // Calculate overall metrics
    const totals = filteredData.reduce((acc, order) => ({
      volume: acc.volume + (order.volume || 0),
      totalCost: acc.totalCost + (order.total_cost || 0),
      orders: acc.orders + 1,
      financialCost: acc.financialCost + (order.daily_financial_cost || 0)
    }), { volume: 0, totalCost: 0, orders: 0, financialCost: 0 });

    setVolumeMetrics({
      totalVolume: Number(totals.volume.toFixed(2)),
      avgPrice: totals.volume > 0 ? Number((totals.totalCost / (totals.volume * 1000)).toFixed(4)) : 0,
      totalOrders: totals.orders,
      totalFinancialCost: Number(totals.financialCost.toFixed(2)),
      totalCost: Number(totals.totalCost.toFixed(2))
    });

    // Top entities by volume
    const entityVolumes = {};
    filteredData.forEach(order => {
      const key = getEntityKey(order);
      if (!entityVolumes[key]) {
        entityVolumes[key] = { volume: 0, cost: 0, orders: 0 };
      }
      entityVolumes[key].volume += order.volume || 0;
      entityVolumes[key].cost += order.total_cost || 0;
      entityVolumes[key].orders += 1;
    });

    const top = Object.entries(entityVolumes)
      .map(([key, value]) => ({
        key,
        name: getEntityName(key),
        volume: Number(value.volume.toFixed(2)),
        avgPrice: value.volume > 0 ? Number((value.cost / (value.volume * 1000)).toFixed(4)) : 0,
        orders: value.orders,
        share: Number(((value.volume / totals.volume) * 100).toFixed(1))
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    setTopEntities(top);

    // Cost analysis by entity
    const costByEntity = Object.entries(entityVolumes).map(([key, value]) => ({
      name: getEntityName(key),
      volume: Number(value.volume.toFixed(2)),
      avgPrice: value.volume > 0 ? Number((value.cost / (value.volume * 1000)).toFixed(4)) : 0,
      totalCost: Number(value.cost.toFixed(2))
    })).sort((a, b) => b.totalCost - a.totalCost);

    setCostAnalysis(costByEntity);
  };

  const handleExport = () => {
    const csvContent = [
      ['Período', selectedDimension === 'brand' ? 'Bandeira' : selectedDimension === 'group' ? 'Grupo' : 'Posto', 'Volume (m³)', 'Preço Médio (R$/L)', 'Total (R$)', 'Pedidos'],
      ...timeSeriesData.map(row => [
        row.period,
        selectedEntity === 'all' ? 'Todos' : getEntityName(selectedEntity),
        row.volume,
        row.avgPrice,
        row.totalCost || row.volume * row.avgPrice * 1000,
        row.orders
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volume-analytics-${selectedDimension}-${selectedPeriod}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: '✅ Dados exportados!' });
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <BarChart3 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl shadow-2xl">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">Análise de Volume</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              Métricas de volume e custo para negociações
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Filters */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-blue-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Período</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Diário</SelectItem>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="quarter">Trimestral</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Agrupar por</Label>
              <Select value={selectedDimension} onValueChange={setSelectedDimension}>
                <SelectTrigger className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">Bandeira</SelectItem>
                  <SelectItem value="group">Grupo</SelectItem>
                  <SelectItem value="station">Posto</SelectItem>
                  <SelectItem value="supplier">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Entidade</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {selectedDimension === 'brand' && ['bandeira_branca', 'petrobras', 'shell', 'vibra', 'raizen', 'ipianga'].map(brand => (
                    <SelectItem key={brand} value={brand}>
                      <div className="flex items-center gap-2">
                        <BrandBadge bandeira={brand} size="xs" />
                        {brand === 'bandeira_branca' ? 'Bandeira Branca' : brand}
                      </div>
                    </SelectItem>
                  ))}
                  {selectedDimension === 'group' && groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                  {selectedDimension === 'station' && postos.map(posto => (
                    <SelectItem key={posto.id} value={posto.id}>{posto.name}</SelectItem>
                  ))}
                  {selectedDimension === 'supplier' && suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Início</Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="mt-1.5 w-full"
              />
            </div>

            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Fim</Label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className="mt-1.5 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="w-4 h-4 text-blue-600" />
              Volume Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {volumeMetrics.totalVolume?.toLocaleString('pt-BR')} m³
            </p>
            <p className="text-sm text-muted-foreground">
              {volumeMetrics.totalOrders} pedidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Preço Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {volumeMetrics.avgPrice?.toFixed(4)}
            </p>
            <p className="text-sm text-muted-foreground">por litro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Custo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              R$ {volumeMetrics.totalCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground">sem frete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              Custo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              R$ {volumeMetrics.totalFinancialCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground">juros/prazos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="w-4 h-4 text-red-600" />
              Top Entidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-red-600 truncate">
              {topEntities[0]?.name || '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              {topEntities[0]?.share}% do volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">Volume no Tempo</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="cost">Análise de Custo</TabsTrigger>
          <TabsTrigger value="table">Dados Detalhados</TabsTrigger>
        </TabsList>

        <TabsContent value="volume">
          <Card>
            <CardHeader>
              <CardTitle>Volume por Período</CardTitle>
              <CardDescription>
                Evolução do volume carregado ao tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'volume' ? `${value} m³` : `R$ ${value}`,
                      name === 'volume' ? 'Volume' : 'Preço Médio'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="volume" fill="#0088FE" name="Volume" />
                  <Line type="monotone" dataKey="avgPrice" stroke="#00C49F" name="Preço Médio" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 por Volume</CardTitle>
              <CardDescription>
                {selectedDimension === 'brand' ? 'Bandeiras' : selectedDimension === 'group' ? 'Grupos' : 'Postos'} com maior volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topEntities} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value) => [`${value} m³`, 'Volume']} />
                  <Bar dataKey="volume" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Custo</CardTitle>
              <CardDescription>
                Custo médio por entidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={costAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => [`R$ ${value}`, 'Preço Médio']} />
                  <Bar dataKey="avgPrice" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Dados Detalhados</CardTitle>
              <CardDescription>
                Volume e custo por entidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entidade</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead className="text-right">Preço Médio</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-right">% Volume</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEntities.map((entity, index) => (
                    <TableRow key={entity.key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {selectedDimension === 'brand' && (
                            <BrandBadge bandeira={entity.key} size="xs" />
                          )}
                          {entity.name}
                          {index === 0 && <Badge className="ml-2">Top</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entity.volume.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R$ {entity.avgPrice.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        R$ {(entity.volume * entity.avgPrice * 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {entity.share}%
                      </TableCell>
                      <TableCell className="text-right">
                        {entity.orders}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </motion.div>
  );
};

export default VolumeAnalytics;
