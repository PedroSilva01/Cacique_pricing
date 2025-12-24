import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, AlertTriangle, ChevronDown, ChevronUp, Save, Trash2, Edit2, Check, X, BarChart3, Download, Filter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BrandBadge from '@/components/ui/BrandBadge';
import { DatePicker } from '@/components/ui/date-picker';

const PurchaseOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [baseCities, setBaseCities] = useState([]);
  const [settings, setSettings] = useState({});
  const [financialCostRate, setFinancialCostRate] = useState(0.00535);
  
  const financialRatesByBrand = {
    ipiranga: 0.00492,
    vibra: 0.00351,
    shell: 0.00615,
    bandeira_branca: 0,
    federal: 0
  };

  const getFinancialRate = (stationId, supplierId = null, paymentDays = 0) => {
    const posto = postos.find(p => p.id === stationId);
    if (!posto) return financialCostRate;

    const brandeira = posto.bandeira;

    // Bandeira branca: só cobra taxa se for Vibra ou Ipiranga
    if (brandeira === 'bandeira_branca') {
      if (supplierId) {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
          const supplierName = supplier.name?.toLowerCase() || '';
          if (supplierName.includes('vibra')) return financialRatesByBrand.vibra || 0.00535;
          if (supplierName.includes('ipiranga')) return financialRatesByBrand.ipiranga || 0.00535;
        }
      }
      // Outros fornecedores de bandeira branca não têm taxa
      return 0;
    }

    // Federal: 0.015 por dia apenas após 3 dias (máximo 5 dias)
    if (brandeira === 'federal') {
      const days = parseInt(paymentDays) || 0;
      if (days > 3 && days <= 5) {
        return 0.015 * (days - 3); // Só conta os dias após o 3º dia
      }
      return 0;
    }

    // Outras bandeiras (Vibra, Ipiranga, Shell)
    if (supplierId) {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier) {
        const supplierName = supplier.name?.toLowerCase() || '';
        if (supplierName.includes('vibra')) return financialRatesByBrand.vibra;
        if (supplierName.includes('ipiranga')) return financialRatesByBrand.ipiranga;
        if (supplierName.includes('shell')) return financialRatesByBrand.shell;
      }
    }

    return financialRatesByBrand[brandeira] || financialCostRate;
  };

  const calculatePaymentDate = (invoiceDate, paymentDays) => {
    if (!invoiceDate) return null;
    const invoice = new Date(invoiceDate + 'T00:00:00');
    const days = parseInt(paymentDays) || 0;
    
    // Prazo 0 = à vista (mesmo dia)
    // Prazo 1 = 1 dia após faturamento
    // Prazo 2 = 2 dias após faturamento, etc.
    invoice.setDate(invoice.getDate() + days);
    return invoice;
  };

  const exportToCSV = () => {
    if (orders.length === 0) {
      toast({ title: '⚠️ Nenhum pedido para exportar', variant: 'destructive' });
      return;
    }

    const headers = ['Posto', 'Base', 'Combustível', 'Volume', 'Preço/L', 'Preço Efetivo', 'Alvo', 'Faturamento', 'Pagamento', 'Fornecedor'];
    const rows = orders.map(order => [
      order.postos?.name || '-',
      order.base_cities?.name || '-',
      settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type,
      order.volume?.toLocaleString('pt-BR') || '-',
      `R$ ${order.price_per_liter?.toFixed(4) || '-'}`,
      `R$ ${order.effective_price?.toFixed(4) || '-'}`,
      order.target_price ? `R$ ${order.target_price.toFixed(4)}` : '-',
      new Date(order.invoice_date).toLocaleDateString('pt-BR'),
      formatPaymentDate(calculatePaymentDate(order.invoice_date, order.payment_days)),
      order.suppliers?.name || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos-${viewDate}.csv`;
    link.click();
    toast({ title: '✅ Exportado com sucesso!' });
  };

  const formatPaymentDate = (date) => {
    if (!date) return '-';
    const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const dayOfWeek = weekDays[date.getDay()];
    const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${formatted} - ${dayOfWeek}`;
  };

  const getFreightCost = (vehicleType, baseId, postoId) => {
    if (!vehicleType || !baseId || !postoId) return 0;
    
    const posto = postos.find(p => p.id === postoId);
    if (!posto?.city_id) return 0;

    const route = freightRoutes.find(r => 
      r.origin_city_id === baseId && 
      r.destination_city_id === posto.city_id
    );

    if (!route?.costs) return 0;
    return route.costs[vehicleType] || 0;
  };

  // Filters - collapsible
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedBase, setSelectedBase] = useState('all');
  const [viewDate, setViewDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  // Multi-product entry
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [productEntries, setProductEntries] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [freightRoutes, setFreightRoutes] = useState([]);

  // Auto-select supplier based on station brand
  useEffect(() => {
    if (!selectedStation) {
      setSelectedSupplier('');
      return;
    }

    const posto = postos.find(p => p.id === selectedStation);
    if (!posto || posto.bandeira === 'bandeira_branca') {
      setSelectedSupplier('');
      return;
    }

    // For non-white label stations, find matching supplier by brand name
    const matchingSupplier = suppliers.find(s => {
      const supplierName = s.name?.toLowerCase() || '';
      return supplierName.includes(posto.bandeira);
    });

    if (matchingSupplier) {
      setSelectedSupplier(matchingSupplier.id);
    }
  }, [selectedStation, postos, suppliers]);

  useEffect(() => {
    if (!userId) return;
    loadInitialData();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadOrders();
  }, [userId, viewDate, selectedBrand, selectedBase]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [postosRes, groupsRes, suppliersRes, basesRes, settingsRes, routesRes] = await Promise.all([
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('base_cities').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('*').eq('user_id', userId).single(),
        supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', userId)
      ]);

      if (postosRes.error) throw postosRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (basesRes.error) throw basesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (routesRes.error) throw routesRes.error;

      setPostos(postosRes.data || []);
      setGroups(groupsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setBaseCities(basesRes.data || []);
      setSettings(settingsRes.data?.settings || {});
      setFinancialCostRate(settingsRes.data?.financial_cost_rate || 0.00535);
      setFreightRoutes(routesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, postos(*, cities(*)), groups(*), suppliers(*), base_cities(*)')
        .eq('user_id', userId)
        .eq('order_date', viewDate);

      if (error) throw error;
      setOrders((data || []).sort((a, b) => {
        // Extract numeric part from order ID (assuming format like "order-1", "order-2", etc.)
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
    }
  }, [userId, viewDate]);

  const getTargetPrice = useCallback((stationId, fuelType, baseId, supplierId = null) => {
    const posto = postos.find(p => p.id === stationId);
    if (!posto) return null;

    // Bandeira branca só tem preço alvo se for Vibra ou Ipiranga
    if (posto.bandeira === 'bandeira_branca') {
      if (!supplierId) return null;
      const supplier = suppliers.find(s => s.id === supplierId);
      if (!supplier) return null;
      const supplierName = supplier.name?.toLowerCase() || '';
      if (!supplierName.includes('vibra') && !supplierName.includes('ipiranga')) {
        return null;
      }
    }

    const groupId = posto.group_ids?.[0];
    if (!groupId) return null;

    const group = groups.find(g => g.id === groupId);
    if (!group?.target_prices) return null;

    const key = baseId && baseId !== 'all' ? `${fuelType}_${baseId}` : fuelType;
    return group.target_prices[key] || group.target_prices[fuelType] || null;
  }, [postos, groups, suppliers]);

  const [dailyPrices, setDailyPrices] = useState([]);

  // Buscar preços do daily_prices (usa invoiceDate para lançamentos, viewDate para visualização)
  useEffect(() => {
    const fetchDailyPrices = async () => {
      if (!userId || !selectedBase || selectedBase === 'all') return;
      
      // Usar invoiceDate se estiver disponível, senão viewDate
      const dateToUse = invoiceDate || viewDate;
      
      try {
        const { data, error } = await supabase
          .from('daily_prices')
          .select('*')
          .eq('user_id', userId)
          .eq('base_city_id', selectedBase)
          .eq('date', dateToUse);
        
        if (error) throw error;
        
        console.log('🔍 Daily Prices carregados:', {
          date: dateToUse,
          base: selectedBase,
          count: data?.length || 0,
          prices: data
        });
        
        setDailyPrices(data || []);
      } catch (err) {
        console.error('Erro ao buscar preços diários:', err);
      }
    };

    fetchDailyPrices();
  }, [userId, selectedBase, viewDate, invoiceDate]);

  const getDailyPrice = useCallback((fuelType, supplierId) => {
    if (!supplierId || dailyPrices.length === 0) return null;
    
    const price = dailyPrices.find(p => 
      p.fuel_type === fuelType && 
      p.supplier_id === supplierId
    );
    
    return price?.price || null;
  }, [dailyPrices]);

  const parseBrazilianNumber = (value) => {
    if (typeof value === 'number') return value;
    const str = String(value).trim();
    const normalized = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const calculatePrice = (totalValue, volume, paymentDays, stationId = null, supplierId = null) => {
    const total = parseBrazilianNumber(totalValue);
    const vol = parseBrazilianNumber(volume);
    const days = parseInt(paymentDays) || 0;
    const rate = stationId ? getFinancialRate(stationId, supplierId, days) : financialCostRate;
    
    const volumeLiters = vol * 1000;
    const pricePerLiter = total / volumeLiters;
    const financialCostPerLiter = rate * days;
    const effectivePrice = pricePerLiter - financialCostPerLiter;
    const totalFinancialCost = financialCostPerLiter * volumeLiters;
    
    return {
      unitPrice: pricePerLiter,
      financialCostPerLiter,
      effectivePrice,
      totalFinancialCost,
      totalValue: total,
      volumeLiters,
      appliedRate: rate
    };
  };

  const addProductEntry = () => {
    if (!settings.fuelTypes || Object.keys(settings.fuelTypes).length === 0) return;
    
    const firstFuel = Object.keys(settings.fuelTypes)[0];
    setProductEntries([...productEntries, {
      id: Date.now(),
      fuelType: firstFuel,
      volume: '',
      totalValue: '',
      paymentDays: '0',
      driverName: '',
      vehicleType: '',
      specificSupplier: ''
    }]);
  };

  const removeProductEntry = (id) => {
    setProductEntries(productEntries.filter(p => p.id !== id));
  };

  const updateProductEntry = (id, field, value) => {
    setProductEntries(productEntries.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleSaveAll = async () => {
    if (!selectedStation || productEntries.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione um posto e adicione ao menos um produto',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedBase || selectedBase === 'all') {
      toast({
        title: 'Base obrigatória',
        description: 'Selecione a base de carregamento',
        variant: 'destructive'
      });
      return;
    }

    const posto = postos.find(p => p.id === selectedStation);

    // Validate all entries
    for (const entry of productEntries) {
      if (!entry.volume || !entry.totalValue) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha volume e valor total para todos os produtos',
          variant: 'destructive'
        });
        return;
      }

      if (posto?.bandeira === 'bandeira_branca' && !entry.specificSupplier) {
        toast({
          title: 'Fornecedor obrigatório',
          description: 'Para bandeira branca é necessário informar o fornecedor de cada produto',
          variant: 'destructive'
        });
        return;
      }
    }

    setSaving(true);
    try {
      const groupId = posto?.group_ids?.[0];
      
      const ordersToSave = productEntries.map(entry => {
        const calc = calculatePrice(entry.totalValue, entry.volume, entry.paymentDays, selectedStation, entry.specificSupplier);
        const freightCostValue = entry.vehicleType && selectedBase && selectedBase !== 'all' 
          ? getFreightCost(entry.vehicleType, selectedBase, selectedStation) 
          : 0;

        const orderData = {
          user_id: userId,
          order_date: viewDate,
          station_id: selectedStation,
          supplier_id: entry.specificSupplier || selectedSupplier,
          fuel_type: entry.fuelType,
          volume: calc.volumeLiters,
          unit_price: calc.unitPrice,
          payment_term_days: parseInt(entry.paymentDays) || 0,
          is_cash_purchase: (parseInt(entry.paymentDays) || 0) === 0,
          financial_cost_rate: calc.appliedRate,
          freight_cost: freightCostValue,
          invoice_date: invoiceDate,
          vehicle_type: entry.vehicleType || null
        };

        if (groupId) {
          orderData.group_id = groupId;
        }

        return orderData;
      });

      for (const order of ordersToSave) {
        const { error } = await supabase
          .from('purchase_orders')
          .upsert(order, {
            onConflict: 'user_id, station_id, order_date, fuel_type'
          });

        if (error) throw error;
      }

      toast({ title: `✅ ${ordersToSave.length} pedido(s) salvo(s)!` });

      // Reset form
      setProductEntries([]);
      loadOrders();
    } catch (err) {
      console.error('Erro ao salvar pedidos:', err);
      showErrorToast(toast, { title: 'Erro ao salvar pedidos', error: err });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (orderId) => {
    if (deleteConfirmId !== orderId) {
      setDeleteConfirmId(orderId);
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', orderId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: '✅ Pedido excluído com sucesso!', description: 'O pedido foi removido.' });
      setDeleteConfirmId(null);
      loadOrders();
    } catch (err) {
      console.error('Erro ao excluir pedido:', err);
      showErrorToast(toast, { title: 'Erro ao excluir', error: err });
    }
  };

  const filteredPostos = useMemo(() => {
    return selectedBrand === 'all' 
      ? postos 
      : postos.filter(p => p.bandeira === selectedBrand);
  }, [postos, selectedBrand]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (selectedBrand !== 'all' && order.postos?.bandeira !== selectedBrand) return false;
      if (selectedBase !== 'all' && order.base_city_id !== selectedBase) return false;
      return true;
    });
  }, [orders, selectedBrand, selectedBase]);

  const statistics = useMemo(() => {
    const incorrect = filteredOrders.filter(o => {
      const targetPrice = o.target_price || getTargetPrice(o.station_id, o.fuel_type, o.base_city_id, o.supplier_id);
      if (!targetPrice) return false;
      
      const calc = calculatePrice(o.total_cost || (o.unit_price * o.volume * 1000), o.volume, o.payment_term_days);
      return Math.abs(calc.effectivePrice - targetPrice) > 0.01;
    });

    const totalExtra = incorrect.reduce((sum, o) => {
      const targetPrice = o.target_price || getTargetPrice(o.station_id, o.fuel_type, o.base_city_id, o.supplier_id);
      if (!targetPrice) return sum;
      
      const calc = calculatePrice(o.total_cost || (o.unit_price * o.volume * 1000), o.volume, o.payment_term_days);
      const diff = calc.effectivePrice - targetPrice;
      return sum + (diff * o.volume * 1000);
    }, 0);

    return {
      total: filteredOrders.length,
      incorrect: incorrect.length,
      extraCost: totalExtra
    };
  }, [filteredOrders, getTargetPrice, financialCostRate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <ShoppingCart className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl shadow-2xl">
              <ShoppingCart className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Pedidos de Compra</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">Gerencie seus pedidos e acompanhe os custos</p>
          </div>
        </div>
        <Button 
          onClick={exportToCSV}
          className="gap-2 h-12 px-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Download className="w-5 h-5" />
          Exportar CSV
        </Button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{statistics.total}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fora do Alvo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{statistics.incorrect}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Extra</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              R$ {statistics.extraCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Filters */}
      <Card className="shadow-md">
        <CardHeader 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
            {filtersExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </CardHeader>
        <AnimatePresence>
          {filtersExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Bandeira</Label>
                    <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="bandeira_branca">Bandeira Branca</SelectItem>
                        <SelectItem value="vibra">Vibra</SelectItem>
                        <SelectItem value="shell">Shell</SelectItem>
                        <SelectItem value="ipiranga">Ipiranga</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Base de Carregamento</Label>
                    <Select value={selectedBase} onValueChange={setSelectedBase}>
                      <SelectTrigger className="h-12 border-orange-400">
                        <SelectValue placeholder="Selecione a base..." />
                      </SelectTrigger>
                      <SelectContent>
                        {baseCities.map(base => (
                          <SelectItem key={base.id} value={base.id}>{base.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Data</Label>
                    <DatePicker
                      value={viewDate}
                      onChange={setViewDate}
                      className="h-12"
                    />
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>


      {/* Multi-Product Entry Form */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            Lançamento Múltiplo
          </CardTitle>
          <CardDescription className="text-base">
            Insira vários produtos de um mesmo posto de uma só vez
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 space-y-8">
          {/* Station, Supplier and Invoice Date Selection */}
          <div className="grid md:grid-cols-3 gap-6 p-6 bg-accent/30 rounded-xl">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Posto *</Label>
              <Select value={selectedStation} onValueChange={setSelectedStation}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o posto..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredPostos.map(posto => (
                    <SelectItem key={posto.id} value={posto.id}>
                      <div className="flex items-center gap-2">
                        <BrandBadge bandeira={posto.bandeira} size="xs" />
                        {posto.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStation && postos.find(p => p.id === selectedStation)?.bandeira !== 'bandeira_branca' && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Fornecedor</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Auto-selecionado" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold mb-2 block">Data de Faturamento *</Label>
              <DatePicker
                value={invoiceDate}
                onChange={setInvoiceDate}
                className="h-12"
              />
            </div>
          </div>

          {/* Product Entries */}
          <div className="space-y-4">
            {productEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 p-6 bg-card border-2 rounded-xl relative shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  {index + 1}
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Combustível *</Label>
                    <Select 
                      value={entry.fuelType} 
                      onValueChange={v => updateProductEntry(entry.id, 'fuelType', v)}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(settings.fuelTypes || {})
                          .filter(key => {
                            const posto = postos.find(p => p.id === selectedStation);
                            if (!posto?.fuel_types || posto.fuel_types.length === 0) return true;
                            return posto.fuel_types.includes(key);
                          })
                          .map(key => (
                            <SelectItem key={key} value={key}>
                              {settings.fuelTypes[key].name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Volume (m³) *</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={entry.volume}
                      onChange={e => updateProductEntry(entry.id, 'volume', e.target.value)}
                      placeholder="38"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Valor Total (R$) *</Label>
                    <Input
                      type="text"
                      value={entry.totalValue}
                      onChange={e => updateProductEntry(entry.id, 'totalValue', e.target.value)}
                      placeholder="150.000,00"
                      className="h-12"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Prazo (dias)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.paymentDays}
                      onChange={e => updateProductEntry(entry.id, 'paymentDays', e.target.value)}
                      className="h-12"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  {selectedStation && postos.find(p => p.id === selectedStation)?.bandeira === 'bandeira_branca' && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Fornecedor deste produto *</Label>
                      <Select 
                        value={entry.specificSupplier || ''} 
                        onValueChange={v => updateProductEntry(entry.id, 'specificSupplier', v)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione o fornecedor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map(supplier => (
                            <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Veículo</Label>
                    <Select 
                      value={entry.vehicleType || ''} 
                      onValueChange={v => updateProductEntry(entry.id, 'vehicleType', v)}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não especificado</SelectItem>
                        {Object.keys(settings.vehicleTypes || {}).map(key => (
                          <SelectItem key={key} value={key}>
                            {settings.vehicleTypes[key].name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Motorista</Label>
                    <Input
                      type="text"
                      value={entry.driverName}
                      onChange={e => updateProductEntry(entry.id, 'driverName', e.target.value)}
                      placeholder="Nome do motorista"
                      className="h-12"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button 
                      variant="destructive" 
                      size="lg"
                      onClick={() => removeProductEntry(entry.id)}
                      className="w-full h-12 text-base font-medium"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Price Preview */}
                {entry.volume && entry.totalValue && (
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200">
                    {(() => {
                      const calc = calculatePrice(entry.totalValue, entry.volume, entry.paymentDays, selectedStation, entry.specificSupplier);
                      const posto = selectedStation ? postos.find(p => p.id === selectedStation) : null;
                      
                      // Preço de referência (alvo ou daily_prices)
                      let referencePrice = null;
                      let referencePriceLabel = 'Preço Alvo';
                      const isBandeiraBranca = posto?.bandeira === 'bandeira_branca';
                      const supplier = entry.specificSupplier ? suppliers.find(s => s.id === entry.specificSupplier) : null;
                      const supplierName = supplier?.name?.toLowerCase() || '';
                      const isVibraOrIpiranga = supplierName.includes('vibra') || supplierName.includes('ipiranga');
                      
                      if (isBandeiraBranca && entry.specificSupplier) {
                        if (isVibraOrIpiranga) {
                          referencePrice = getTargetPrice(selectedStation, entry.fuelType, selectedBase, entry.specificSupplier);
                        } else {
                          // Para outros fornecedores, buscar do daily_prices
                          referencePrice = getDailyPrice(entry.fuelType, entry.specificSupplier);
                          referencePriceLabel = 'Preço Fornecedor';
                          
                          console.log('🔍 Buscando preço fornecedor:', {
                            fuelType: entry.fuelType,
                            supplierId: entry.specificSupplier,
                            supplierName: supplier?.name,
                            dailyPricesCount: dailyPrices.length,
                            foundPrice: referencePrice
                          });
                        }
                      } else {
                        referencePrice = selectedStation ? getTargetPrice(selectedStation, entry.fuelType, selectedBase, entry.specificSupplier) : null;
                      }
                      
                      const diff = referencePrice ? (calc.effectivePrice - referencePrice) : 0;
                      const isOutOfTarget = referencePrice && Math.abs(diff) > 0.01;
                      
                      // Alerta de divergência grande (> 5%)
                      const divergencePercent = referencePrice ? Math.abs(diff / referencePrice) * 100 : 0;
                      const hasBigDivergence = divergencePercent > 5;
                      
                      const freightCost = entry.vehicleType && selectedBase && selectedBase !== 'all' ? getFreightCost(entry.vehicleType, selectedBase, selectedStation) : 0;
                      const paymentDate = calculatePaymentDate(invoiceDate, entry.paymentDays);
                      
                      // Calcular preço final com frete (inclui taxa quando aplicável)
                      const priceWithFreight = freightCost > 0 ? (calc.effectivePrice + freightCost) : null;
                      
                      return (
                        <>
                          <div className="grid md:grid-cols-6 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-xs text-muted-foreground block mb-1">Volume Total</span>
                              <span className="font-mono font-bold text-base">{calc.volumeLiters.toLocaleString('pt-BR')} L</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground block mb-1">Valor Total</span>
                              <span className="font-mono font-bold text-base">R$ {calc.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground block mb-1">Preço/Litro</span>
                              <span className="font-mono font-bold text-base text-blue-600">R$ {calc.unitPrice.toFixed(4)}</span>
                            </div>
                            {calc.appliedRate > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground block mb-1">Taxa/Dia</span>
                                <span className="font-mono font-bold text-base">R$ {calc.appliedRate.toFixed(5)}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-muted-foreground block mb-1">Prazo</span>
                              <span className="font-mono font-bold text-base">{entry.paymentDays || 0} dias</span>
                            </div>
                            {freightCost > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground block mb-1">Frete/L</span>
                                <span className="font-mono font-bold text-base text-orange-600">R$ {freightCost.toFixed(4)}</span>
                              </div>
                            )}
                            {paymentDate && (
                              <div>
                                <span className="text-xs text-muted-foreground block mb-1">Pagamento</span>
                                <span className="font-mono font-bold text-base text-green-600">
                                  {formatPaymentDate(paymentDate)}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {hasBigDivergence && (
                            <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-500 rounded">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-xs font-bold text-red-800">
                                  ALERTA: Divergência de {divergencePercent.toFixed(1)}% do preço de referência!
                                </span>
                              </div>
                            </div>
                          )}
                          
                          <div className="grid md:grid-cols-4 gap-3 text-sm pt-2 border-t border-blue-300">
                            {calc.financialCostPerLiter > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground block">Custo Fin./Litro</span>
                                <span className="font-mono font-bold text-orange-600">R$ {calc.financialCostPerLiter.toFixed(4)}</span>
                                <span className="text-xs text-muted-foreground block mt-1">
                                  ({calc.totalFinancialCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total)
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-muted-foreground block">Preço Efetivo</span>
                              <span className="font-mono font-bold text-green-600">R$ {calc.effectivePrice.toFixed(4)}</span>
                              <span className="text-xs text-muted-foreground block mt-1">
                                {calc.financialCostPerLiter > 0 ? '(após desconto financeiro)' : '(preço base)'}
                              </span>
                            </div>
                            {freightCost > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground block">Preço Final c/ Frete</span>
                                <span className="font-mono font-bold text-blue-600">R$ {priceWithFreight.toFixed(4)}</span>
                                <span className="text-xs text-muted-foreground block mt-1">
                                  {isBandeiraBranca && !isVibraOrIpiranga ? '(sem taxa + frete)' : '(c/ taxa + frete)'}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-muted-foreground block">{referencePriceLabel}</span>
                              <span className="font-mono font-bold">
                                R$ {referencePrice?.toFixed(4) || 'N/D'}
                              </span>
                            </div>
                            {referencePrice && (
                              <div>
                                <span className="text-xs text-muted-foreground block">Status</span>
                                {isOutOfTarget ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-800">
                                    ⚠️ {diff > 0 ? '+' : ''}{(diff * 100).toFixed(2)}¢ acima
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">
                                    ✓ Dentro do alvo
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            ))}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={addProductEntry}
                className="flex-1 h-12"
                disabled={!selectedStation}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
              
              {productEntries.length > 0 && (
                <Button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar Todos ({productEntries.length})</>}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pedidos do Dia</CardTitle>
              <CardDescription>
                {new Date(viewDate).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posto</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Preço/L</TableHead>
                  <TableHead className="text-right">Preço Efetivo</TableHead>
                  <TableHead className="text-right">Alvo</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado para esta data
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const calc = calculatePrice(order.total_cost || (order.unit_price * order.volume * 1000), order.volume, order.payment_term_days);
                    const targetPrice = order.target_price || getTargetPrice(order.station_id, order.fuel_type, order.base_city_id, order.supplier_id);
                    const isOutOfTarget = targetPrice && Math.abs(calc.effectivePrice - targetPrice) > 0.01;
                    const priceDiff = targetPrice ? calc.effectivePrice - targetPrice : 0;

                    return (
                      <TableRow key={order.id} className={isOutOfTarget ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BrandBadge bandeira={order.postos?.bandeira} size="xs" />
                            <span className="font-medium">{order.postos?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {baseCities.find(b => b.id === order.base_city_id)?.name || 'N/D'}
                        </TableCell>
                        <TableCell>{settings.fuelTypes?.[order.fuel_type]?.name || order.fuel_type}</TableCell>
                        <TableCell className="text-right">{order.volume} m³</TableCell>
                        <TableCell className="text-right font-mono">R$ {order.unit_price.toFixed(4)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">
                          R$ {calc.effectivePrice.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {targetPrice ? `R$ ${targetPrice.toFixed(4)}` : 'N/D'}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {order.invoice_date ? new Date(order.invoice_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-green-600">
                          {order.invoice_date && order.payment_term_days ? 
                            formatPaymentDate(calculatePaymentDate(order.invoice_date, order.payment_term_days))
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          R$ {order.total_cost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isOutOfTarget ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                +{(priceDiff * 100).toFixed(2)}¢
                              </span>
                            </div>
                          ) : targetPrice ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <Check className="w-3 h-3 mr-1" />
                              OK
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem alvo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {deleteConfirmId === order.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(order.id)} className="h-8 px-2">
                                <Check className="w-4 h-4 mr-1" />
                                Confirmar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)} className="h-8 px-2">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(order.id)} className="h-8 w-8 p-0">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </motion.div>
  );
};

export default PurchaseOrders;
