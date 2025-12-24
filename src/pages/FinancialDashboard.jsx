import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown, DollarSign, Truck, Filter, BarChart3 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

export default function FinancialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState({});

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBrand, setSelectedBrand] = useState('all');

  const financialRatesByBrand = {
    ipiranga: 0.00492,
    vibra: 0.00351,
    shell: 0.00615,
    bandeira_branca: 0.00535
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, postosRes, groupsRes, suppliersRes, settingsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('user_id', userId),
        supabase.from('postos').select('*').eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('*').eq('user_id', userId).single()
      ]);

      setOrders(ordersRes.data || []);
      setPostos(postosRes.data || []);
      setGroups(groupsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setSettings(settingsRes.data?.settings || {});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast({ title: '❌ Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.order_date);
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (orderDate < start || orderDate > end) return false;

      if (selectedBrand !== 'all') {
        const posto = postos.find(p => p.id === order.station_id);
        if (!posto || posto.bandeira !== selectedBrand) return false;
      }

      return true;
    });
  }, [orders, startDate, endDate, selectedBrand, postos]);

  const summary = useMemo(() => {
    let totalVolume = 0;
    let totalValue = 0;
    let totalFinancialCost = 0;
    let ordersByBrand = {};
    let ordersByFuel = {};
    let cashVolume = 0;
    let cashValue = 0;
    let creditVolume = 0;
    let creditValue = 0;

    filteredOrders.forEach(order => {
      const volume = order.volume || 0;
      const unitPrice = order.unit_price || 0;
      const days = order.payment_term_days || 0;
      const isCash = order.is_cash_purchase || days === 0;
      
      const posto = postos.find(p => p.id === order.station_id);
      const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
      
      const orderValue = unitPrice * volume;
      const financialCost = rate * days * volume;

      totalVolume += volume;
      totalValue += orderValue;
      totalFinancialCost += financialCost;

      // Separar à vista vs prazo
      if (isCash) {
        cashVolume += volume;
        cashValue += orderValue;
      } else {
        creditVolume += volume;
        creditValue += orderValue;
      }

      const brand = posto?.bandeira || 'desconhecido';
      ordersByBrand[brand] = (ordersByBrand[brand] || 0) + orderValue;

      const fuel = order.fuel_type || 'desconhecido';
      ordersByFuel[fuel] = (ordersByFuel[fuel] || 0) + volume;
    });

    return {
      totalOrders: filteredOrders.length,
      totalVolume,
      totalValue,
      totalFinancialCost,
      averagePrice: totalVolume > 0 ? totalValue / totalVolume : 0,
      ordersByBrand,
      ordersByFuel,
      cashOrders: filteredOrders.filter(o => o.is_cash_purchase || (o.payment_term_days || 0) === 0).length,
      creditOrders: filteredOrders.filter(o => !o.is_cash_purchase && (o.payment_term_days || 0) > 0).length,
      cashVolume,
      cashValue,
      creditVolume,
      creditValue
    };
  }, [filteredOrders, postos]);

  const exportToCSV = () => {
    const headers = ['Data', 'Posto', 'Combustível', 'Volume (L)', 'Preço/L', 'Valor Total', 'Prazo', 'Custo Financeiro', 'Fornecedor'];
    const rows = filteredOrders.map(order => {
      const posto = postos.find(p => p.id === order.station_id);
      const supplier = suppliers.find(s => s.id === order.supplier_id);
      const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
      const financialCost = rate * (order.payment_term_days || 0) * (order.volume || 0);
      
      return [
        order.order_date,
        posto?.nome || 'N/D',
        order.fuel_type,
        order.volume || 0,
        (order.unit_price || 0).toFixed(4),
        ((order.unit_price || 0) * (order.volume || 0)).toFixed(2),
        order.payment_term_days || 0,
        financialCost.toFixed(2),
        supplier?.name || 'N/D'
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_financeiro_${startDate}_${endDate}.csv`;
    link.click();

    toast({ title: '✅ Relatório exportado!', description: 'Arquivo CSV baixado com sucesso.' });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
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
            <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">Dashboard Financeiro</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">Análise completa de custos e despesas</p>
          </div>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Filters */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="w-5 h-5 text-green-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Inicial</Label>
              <Input
                type="date"
                className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Data Final</Label>
              <Input
                type="date"
                className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Bandeira</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="ipiranga">Ipiranga</SelectItem>
                  <SelectItem value="vibra">Vibra</SelectItem>
                  <SelectItem value="shell">Shell</SelectItem>
                  <SelectItem value="bandeira_branca">Bandeira Branca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">pedidos no período</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{summary.totalVolume.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground mt-1">litros</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 backdrop-blur-sm rounded-2xl hover:shadow-xl transition-all border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              R$ {summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: R$ {summary.averagePrice.toFixed(4)}/L
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              R$ {summary.totalFinancialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((summary.totalFinancialCost / summary.totalValue) * 100).toFixed(2)}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo À Vista vs Prazo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Comparativo: À Vista vs Prazo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* À Vista */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="font-semibold text-lg">À Vista</h3>
              </div>
              <div className="space-y-2 pl-5">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos:</span>
                  <span className="font-mono font-bold text-green-600">{summary.cashOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume:</span>
                  <span className="font-mono font-bold text-green-600">{summary.cashVolume.toLocaleString('pt-BR')} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-mono font-bold text-green-600">
                    R$ {summary.cashValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">% do Total:</span>
                  <span className="font-mono font-bold text-green-600">
                    {summary.totalValue > 0 ? ((summary.cashValue / summary.totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* A Prazo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="font-semibold text-lg">A Prazo</h3>
              </div>
              <div className="space-y-2 pl-5">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos:</span>
                  <span className="font-mono font-bold text-orange-600">{summary.creditOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume:</span>
                  <span className="font-mono font-bold text-orange-600">{summary.creditVolume.toLocaleString('pt-BR')} L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-mono font-bold text-orange-600">
                    R$ {summary.creditValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">% do Total:</span>
                  <span className="font-mono font-bold text-orange-600">
                    {summary.totalValue > 0 ? ((summary.creditValue / summary.totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Bandeira</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary.ordersByBrand).map(([brand, value]) => {
                const percentage = (value / summary.totalValue) * 100;
                return (
                  <div key={brand} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{brand.replace('_', ' ')}</span>
                      <span className="font-bold">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% do total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume por Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(summary.ordersByFuel).map(([fuel, volume]) => {
                const percentage = (volume / summary.totalVolume) * 100;
                return (
                  <div key={fuel} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="uppercase font-medium">{fuel}</span>
                      <span className="font-bold">{volume.toLocaleString('pt-BR')} L</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% do total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento dos Pedidos</CardTitle>
          <CardDescription>
            {filteredOrders.length} pedidos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Posto</th>
                  <th className="text-left p-2">Combustível</th>
                  <th className="text-right p-2">Volume (L)</th>
                  <th className="text-right p-2">Preço/L</th>
                  <th className="text-right p-2">Valor Total</th>
                  <th className="text-right p-2">Prazo</th>
                  <th className="text-right p-2">Custo Fin.</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const posto = postos.find(p => p.id === order.station_id);
                  const rate = posto ? (financialRatesByBrand[posto.bandeira] || 0.00535) : 0.00535;
                  const financialCost = rate * (order.payment_term_days || 0) * (order.volume || 0);
                  const totalValue = (order.unit_price || 0) * (order.volume || 0);

                  return (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{new Date(order.order_date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-2">{posto?.nome || 'N/D'}</td>
                      <td className="p-2 uppercase">{order.fuel_type}</td>
                      <td className="p-2 text-right font-mono">{(order.volume || 0).toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right font-mono">R$ {(order.unit_price || 0).toFixed(4)}</td>
                      <td className="p-2 text-right font-mono font-bold">R$ {totalValue.toFixed(2)}</td>
                      <td className="p-2 text-right">{order.payment_term_days || 0}d</td>
                      <td className="p-2 text-right font-mono text-orange-600">R$ {financialCost.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </motion.div>
  );
}
