import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Calendar, Filter, DollarSign, Fuel, Building, MapPin, Download, FileText, AlertTriangle, Target, TrendingDown, Lightbulb, Shield, Zap } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
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
  
  // NOVO: Métricas avançadas para rework
  const [priceVariation, setPriceVariation] = useState({});
  const [economyInsights, setEconomyInsights] = useState({});
  const [monthlyComparison, setMonthlyComparison] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!userId) return;
    setDateDefaults();
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (data.length > 0) {
      processData();
    }
  }, [data, selectedPeriod, selectedDimension, selectedEntity, startDate, endDate]);

  const setDateDefaults = () => {
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    setStartDate(lastYear.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // CORRIGIDO: Usar mesma query do Financial Dashboard (sem joins desnecessários)
      const [ordersRes, groupsRes, postosRes, suppliersRes, settingsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('postos').select('*').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('*').eq('user_id', userId).single()
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
        // CORRIGIDO: Buscar posto na array de postos carregada
        const posto = postos.find(p => p.id === order.station_id);
        return posto?.bandeira || 'bandeira_branca';
      case 'group':
        return order.group_id || 'no-group';
      case 'station':
        return order.station_id || 'no-station';
      case 'supplier':
        return order.supplier_id || 'no-supplier';
      default:
        return 'all';
    }
  };

  const getEntityName = (key) => {
    switch (selectedDimension) {
      case 'brand':
        // CORRIGIDO: Mapear bandeiras corretamente
        const brandNames = {
          'ipiranga': 'Ipiranga',
          'petrobras': 'Petrobras', 
          'shell': 'Shell',
          'vibra': 'Vibra',
          'raizen': 'Raízen',
          'bandeira_branca': 'Bandeira Branca'
        };
        return brandNames[key] || key;
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
    // CORRIGIDO: Definir taxas financeiras no início
    const financialRatesByBrand = {
      'petrobras': 0.00535,
      'shell': 0.00535, 
      'vibra': 0.00535,
      'raizen': 0.00535,
      'ipiranga': 0.00535,
      'bandeira_branca': 0.00535
    };

    // CORRIGIDO: Aplicar filtros de data primeiro, igual ao Financial Dashboard
    let filteredData = data.filter(order => {
      const orderDate = new Date(order.order_date);
      const start = startDate ? new Date(startDate) : new Date('2020-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      
      return orderDate >= start && orderDate <= end;
    });

    // Depois filtrar por entidade selecionada
    filteredData = selectedEntity === 'all' 
      ? filteredData 
      : filteredData.filter(order => getEntityKey(order) === selectedEntity);

    // Aggregate by period and entity
    const aggregated = {};
    
    filteredData.forEach(order => {
      const periodKey = getPeriodKey(order.order_date);
      const entityKey = getEntityKey(order);
      
      if (!aggregated[periodKey]) {
        aggregated[periodKey] = {};
      }
      if (!aggregated[periodKey][entityKey]) {
        aggregated[periodKey][entityKey] = { volume: 0, totalCost: 0, orders: 0, financialCost: 0 };
      }
      
      const volume = order.volume || 0;
      const unitPrice = order.unit_price || 0;
      const orderValue = unitPrice * volume;
      
      // CORRIGIDO: Usar fórmula correta com taxa do banco
      const financialCostRate = order.financial_cost_rate || 0;
      const paymentDays = order.payment_term_days || 0;
      
      // Fórmula: taxa × dias × volume
      const financialCost = financialCostRate * paymentDays * volume;
      
      aggregated[periodKey][entityKey].volume += volume;
      aggregated[periodKey][entityKey].totalCost += orderValue;
      aggregated[periodKey][entityKey].orders += 1;
      aggregated[periodKey][entityKey].financialCost += financialCost;
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
        // CORRIGIDO: Não dividir por 1000 novamente - totalCost já está ajustado
        avgPrice: total.volume > 0 ? Number((total.totalCost / total.volume).toFixed(4)) : 0,
        orders: total.orders,
        financialCost: Number(total.financialCost.toFixed(2))
      };
    }).sort((a, b) => a.period.localeCompare(b.period));

    setTimeSeriesData(seriesData);


    const totals = filteredData.reduce((acc, order) => {
      const volume = order.volume || 0;
      const unitPrice = order.unit_price || 0;
      const orderValue = unitPrice * volume;
      
      // CORRIGIDO: Usar fórmula correta com taxa do banco
      const financialCostRate = order.financial_cost_rate || 0;
      const paymentDays = order.payment_term_days || 0;
      
      // Fórmula: taxa × dias × volume
      // Ex: 0,00492 × 10 × 60000 = 2.952,00
      const financialCost = financialCostRate * paymentDays * volume;
      
      
      return {
        volume: acc.volume + volume,
        totalCost: acc.totalCost + orderValue,
        orders: acc.orders + 1,
        financialCost: acc.financialCost + financialCost
      };
    }, { volume: 0, totalCost: 0, orders: 0, financialCost: 0 });


    setVolumeMetrics({
      totalVolume: Number(totals.volume.toFixed(2)),
      // CORRIGIDO: Não dividir por 1000 novamente - totalCost já está ajustado
      avgPrice: totals.volume > 0 ? Number((totals.totalCost / totals.volume).toFixed(4)) : 0,
      totalOrders: totals.orders,
      totalFinancialCost: Number(totals.financialCost.toFixed(2)),
      totalCost: Number(totals.totalCost.toFixed(2))
    });

    // Top entities by volume
    const entityVolumes = {};
    filteredData.forEach((order, index) => {
      const key = getEntityKey(order);
      
      if (!entityVolumes[key]) {
        entityVolumes[key] = { volume: 0, cost: 0, orders: 0 };
      }
      const unitPrice = order.unit_price || 0;
      const orderValue = unitPrice * (order.volume || 0);
      
      entityVolumes[key].volume += order.volume || 0;
      entityVolumes[key].cost += orderValue;
      entityVolumes[key].orders += 1;
    });

    const top = Object.entries(entityVolumes)
      .map(([key, value]) => ({
        key,
        name: getEntityName(key),
        volume: Number(value.volume.toFixed(2)),
        // CORRIGIDO: Não dividir por 1000 novamente - value.cost já está ajustado
        avgPrice: value.volume > 0 ? Number((value.cost / value.volume).toFixed(4)) : 0,
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
      // CORRIGIDO: Não dividir por 1000 novamente - value.cost já está ajustado
      avgPrice: value.volume > 0 ? Number((value.cost / value.volume).toFixed(4)) : 0,
      totalCost: Number(value.cost.toFixed(2))
    })).sort((a, b) => b.totalCost - a.totalCost);

    setCostAnalysis(costByEntity);

    // NOVO: Calcular métricas avançadas
    calculateAdvancedMetrics(filteredData, totals);
  };

  // NOVO: Função para calcular métricas avançadas
  const calculateAdvancedMetrics = (filteredData, totals) => {
    // 1. Variação de preços ao longo do tempo
    const pricesByMonth = {};
    filteredData.forEach(order => {
      const month = order.order_date.substring(0, 7); // YYYY-MM
      const price = order.volume > 0 ? (order.total_cost / (order.volume * 1000)) : 0;
      
      if (!pricesByMonth[month]) {
        pricesByMonth[month] = { prices: [], volume: 0 };
      }
      
      if (price > 0) {
        pricesByMonth[month].prices.push(price);
        pricesByMonth[month].volume += order.volume || 0;
      }
    });

    // Calcular variação mensal de preços
    const monthlyPrices = Object.entries(pricesByMonth).map(([month, data]) => {
      const avgPrice = data.prices.length > 0 
        ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length 
        : 0;
      return { month, avgPrice, volume: data.volume };
    }).sort((a, b) => a.month.localeCompare(b.month));

    // Calcular variação percentual
    let priceVariationData = {};
    if (monthlyPrices.length >= 2) {
      const currentMonth = monthlyPrices[monthlyPrices.length - 1];
      const previousMonth = monthlyPrices[monthlyPrices.length - 2];
      const yearAgo = monthlyPrices.find(m => {
        const current = new Date(currentMonth.month + '-01');
        const compare = new Date(m.month + '-01');
        return Math.abs((current - compare) / (1000 * 60 * 60 * 24 * 365)) >= 0.9;
      });

      priceVariationData = {
        monthOverMonth: previousMonth.avgPrice > 0 
          ? ((currentMonth.avgPrice - previousMonth.avgPrice) / previousMonth.avgPrice * 100)
          : 0,
        yearOverYear: yearAgo && yearAgo.avgPrice > 0
          ? ((currentMonth.avgPrice - yearAgo.avgPrice) / yearAgo.avgPrice * 100)
          : 0,
        currentAvg: currentMonth.avgPrice,
        trend: monthlyPrices.slice(-3), // últimos 3 meses
      };
    }

    setPriceVariation(priceVariationData);
    setMonthlyComparison(monthlyPrices);

    // 2. Insights de economia
    const avgPrice = totals.volume > 0 ? totals.totalCost / (totals.volume * 1000) : 0;
    const bestPrice = Math.min(...filteredData.filter(o => o.volume > 0).map(o => o.total_cost / (o.volume * 1000)));
    const worstPrice = Math.max(...filteredData.filter(o => o.volume > 0).map(o => o.total_cost / (o.volume * 1000)));
    
    const potentialSavings = totals.volume * 1000 * (avgPrice - bestPrice);
    const avoidedLosses = totals.volume * 1000 * (worstPrice - avgPrice);

    setEconomyInsights({
      avgPrice,
      bestPrice,
      worstPrice,
      potentialSavings: potentialSavings > 0 ? potentialSavings : 0,
      avoidedLosses: avoidedLosses > 0 ? avoidedLosses : 0,
      priceSpread: worstPrice - bestPrice,
      totalVolume: totals.volume
    });

    // 3. Alertas e recomendações
    const alertsList = [];
    
    // Alerta de variação de preço
    if (priceVariationData.monthOverMonth > 5) {
      alertsList.push({
        type: 'warning',
        icon: '📈',
        title: 'Preços em alta',
        message: `Preços subiram ${priceVariationData.monthOverMonth.toFixed(1)}% no último mês`,
        action: 'Considere antecipar compras ou negociar contratos'
      });
    } else if (priceVariationData.monthOverMonth < -5) {
      alertsList.push({
        type: 'success',
        icon: '📉',
        title: 'Oportunidade de economia',
        message: `Preços caíram ${Math.abs(priceVariationData.monthOverMonth).toFixed(1)}% no último mês`,
        action: 'Bom momento para aumentar volume de compra'
      });
    }

    // Alerta de economia potencial
    if (potentialSavings > totals.totalCost * 0.02) { // >2% do total
      alertsList.push({
        type: 'info',
        icon: '💰',
        title: 'Potencial de economia',
        message: `Possível economia de R$ ${potentialSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
        action: 'Foque em fornecedores com melhores preços'
      });
    }

    // Alerta de concentração de fornecedor
    const supplierConcentration = {};
    filteredData.forEach(order => {
      const supplier = order.suppliers?.name || 'N/A';
      supplierConcentration[supplier] = (supplierConcentration[supplier] || 0) + (order.volume || 0);
    });
    
    const topSupplierVolume = Math.max(...Object.values(supplierConcentration));
    const concentrationRate = topSupplierVolume / totals.volume;
    
    if (concentrationRate > 0.7) {
      const topSupplier = Object.entries(supplierConcentration)
        .find(([name, volume]) => volume === topSupplierVolume)?.[0];
      
      alertsList.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Alta concentração',
        message: `${(concentrationRate * 100).toFixed(0)}% do volume com ${topSupplier}`,
        action: 'Considere diversificar fornecedores para reduzir risco'
      });
    }

    setAlerts(alertsList);
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
                onChange={(newDate) => {
                  setStartDate(newDate);
                  // Trigger data reload
                  setTimeout(() => {
                    if (newDate && endDate) fetchData();
                  }, 100);
                }}
                className="mt-1.5 w-full"
              />
            </div>

            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Fim</Label>
              <DatePicker
                value={endDate}
                onChange={(newDate) => {
                  setEndDate(newDate);
                  // Trigger data reload
                  setTimeout(() => {
                    if (startDate && newDate) fetchData();
                  }, 100);
                }}
                className="mt-1.5 w-full"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={fetchData}
                variant="outline"
                className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20 font-semibold shadow-md hover:shadow-lg transition-all rounded-xl h-12"
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                🔄 Atualizar
              </Button>
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
              Preço Médio Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {volumeMetrics.avgPrice?.toFixed(4)}
            </p>
            <p className="text-sm text-muted-foreground">por litro (período filtrado)</p>
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
              R$ {volumeMetrics.totalCost?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground">combustível (período filtrado)</p>
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
              R$ {volumeMetrics.totalFinancialCost?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-muted-foreground">taxa × prazo × volume</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="w-4 h-4 text-red-600" />
              Top {selectedDimension === 'brand' ? 'Bandeira' : selectedDimension === 'group' ? 'Grupo' : selectedDimension === 'station' ? 'Posto' : 'Fornecedor'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-red-600 truncate">
              {topEntities[0]?.name || '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              {topEntities[0]?.share}% do volume (período filtrado)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NOVO: Alertas e Insights */}
      {alerts.length > 0 && (
        <Card className="border-none shadow-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-yellow-200 dark:border-yellow-700 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              🚨 Alertas e Recomendações
            </CardTitle>
            <CardDescription className="text-base">
              Insights acionáveis para otimizar suas negociações
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4">
              {alerts.map((alert, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border-2 ${
                    alert.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                    alert.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{alert.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{alert.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{alert.message}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2 bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg">
                        💡 {alert.action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NOVO: Métricas Avançadas */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Variação de Preços */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-purple-200 dark:border-purple-700 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              📊 Variação de Preços
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Mês a mês:</span>
              <span className={`font-bold text-lg ${
                (priceVariation.monthOverMonth || 0) >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {(priceVariation.monthOverMonth || 0) >= 0 ? '📈' : '📉'} {Math.abs(priceVariation.monthOverMonth || 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Ano a ano:</span>
              <span className={`font-bold text-lg ${
                (priceVariation.yearOverYear || 0) >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {(priceVariation.yearOverYear || 0) >= 0 ? '📈' : '📉'} {Math.abs(priceVariation.yearOverYear || 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Preço atual:</span>
              <span className="font-bold text-lg text-purple-600 font-mono">
                R$ {(priceVariation.currentAvg || 0).toFixed(4)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Economia Potencial */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-green-200 dark:border-green-700 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-green-600" />
              💰 Potencial de Economia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Economia Possível</p>
              <p className="text-2xl font-bold text-green-600 font-mono">
                R$ {(economyInsights.potentialSavings || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Usando sempre o melhor preço
              </p>
            </div>
            <div className="text-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Perdas Evitadas</p>
              <p className="text-2xl font-bold text-emerald-600 font-mono">
                R$ {(economyInsights.avoidedLosses || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Vs. pior cenário
              </p>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Spread:</span>
              <span className="font-bold text-lg text-amber-600 font-mono">
                R$ {((economyInsights.priceSpread || 0) * 1000).toFixed(2)}/m³
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Eficiência Operacional */}
        <Card className="border-none shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-blue-600" />
              ⚡ Eficiência Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Volume/Pedido:</span>
              <span className="font-bold text-lg text-blue-600 font-mono">
                {volumeMetrics.totalOrders > 0 
                  ? (volumeMetrics.totalVolume / volumeMetrics.totalOrders).toFixed(1)
                  : '0'
                } m³
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Custo/m³:</span>
              <span className="font-bold text-lg text-indigo-600 font-mono">
                R$ {volumeMetrics.totalVolume > 0 
                  ? (volumeMetrics.totalCost / volumeMetrics.totalVolume).toFixed(0)
                  : '0'
                }
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">% Financeiro:</span>
              <span className="font-bold text-lg text-purple-600 font-mono">
                {volumeMetrics.totalCost > 0 
                  ? ((volumeMetrics.totalFinancialCost / volumeMetrics.totalCost) * 100).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">Volume no Tempo</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="cost">Análise de Custo</TabsTrigger>
          <TabsTrigger value="prices">📊 Variação de Preços</TabsTrigger>
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

        {/* NOVO: Aba de Variação de Preços */}
        <TabsContent value="prices">
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardTitle className="flex items-center gap-2 text-xl">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                📈 Evolução de Preços Mensais
              </CardTitle>
              <CardDescription className="text-base">
                Acompanhe a variação de preços ao longo do tempo para identificar tendências
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              {monthlyComparison.length > 0 ? (
                <div className="space-y-6">
                  {/* Gráfico de Linha - Evolução de Preços */}
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={monthlyComparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        tickFormatter={(value) => {
                          const date = new Date(value + '-01');
                          return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                        }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${value.toFixed(3)}`}
                        domain={['dataMin - 0.01', 'dataMax + 0.01']}
                      />
                      <Tooltip 
                        formatter={(value, name) => [
                          `R$ ${Number(value).toFixed(4)}/L`, 
                          'Preço Médio'
                        ]}
                        labelFormatter={(value) => {
                          const date = new Date(value + '-01');
                          return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="avgPrice" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        name="Preço Médio (R$/L)"
                        dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#8b5cf6', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Estatísticas de Tendência */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Target className="w-5 h-5 text-purple-600" />
                          📊 Estatísticas do Período
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Preço Mínimo:</span>
                          <span className="font-bold text-green-600 font-mono">
                            R$ {Math.min(...monthlyComparison.map(m => m.avgPrice)).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Preço Máximo:</span>
                          <span className="font-bold text-red-600 font-mono">
                            R$ {Math.max(...monthlyComparison.map(m => m.avgPrice)).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Média Geral:</span>
                          <span className="font-bold text-purple-600 font-mono">
                            R$ {(monthlyComparison.reduce((sum, m) => sum + m.avgPrice, 0) / monthlyComparison.length).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Volatilidade:</span>
                          <span className="font-bold text-amber-600 font-mono">
                            {((Math.max(...monthlyComparison.map(m => m.avgPrice)) - Math.min(...monthlyComparison.map(m => m.avgPrice))) * 1000).toFixed(2)} R$/m³
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Zap className="w-5 h-5 text-blue-600" />
                          🎯 Últimos 3 Meses
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {priceVariation.trend && priceVariation.trend.length > 0 ? (
                          <div className="space-y-3">
                            {priceVariation.trend.map((month, index) => (
                              <div key={month.month} className="flex justify-between items-center p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {new Date(month.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}:
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-blue-600 font-mono">
                                    R$ {month.avgPrice.toFixed(4)}
                                  </span>
                                  {index > 0 && (
                                    <span className={`text-sm ${
                                      month.avgPrice > priceVariation.trend[index - 1].avgPrice ? 'text-red-500' : 'text-green-500'
                                    }`}>
                                      {month.avgPrice > priceVariation.trend[index - 1].avgPrice ? '📈' : '📉'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4">
                            Dados insuficientes para análise de tendência
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-800 dark:to-pink-900 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700">
                  <TrendingDown className="w-16 h-16 text-purple-400 dark:text-purple-600 mb-4" />
                  <p className="text-center text-purple-600 dark:text-purple-400 font-semibold text-lg mb-2">
                    Sem dados de variação de preços
                  </p>
                  <p className="text-center text-purple-500 dark:text-purple-500 text-sm">
                    Dados históricos insuficientes para análise de tendências
                  </p>
                </div>
              )}
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
