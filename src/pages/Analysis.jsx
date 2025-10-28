
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, AlertTriangle, LineChart as LineChartIcon, Fuel, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { defaultSettings } from '@/lib/mockData';
import AverageFuelPricesChart from '@/components/AverageFuelPricesChart';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#64748b', '#f59e0b', '#34d399', '#a78bfa'];

const CustomTooltip = ({ active, payload, label, currency = 'BRL' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-effect rounded-lg p-4 border shadow-md bg-background/80 backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-2">{`Data: ${label}`}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-sm">
            {`${p.name}: ${p.value.toLocaleString('pt-BR', { style: 'currency', currency, minimumFractionDigits: currency === 'BRL' ? 4 : 2 })}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Analysis = () => {
  const [dbData, setDbData] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [baseCities, setBaseCities] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [oilPrices, setOilPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fuelTypes = useMemo(() => settings.fuelTypes || {}, [settings]);
  const [selectedFuels, setSelectedFuels] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [selectedBase, setSelectedBase] = useState('all');
  const [fuelPeriod, setFuelPeriod] = useState('weekly'); // 'weekly' or 'monthly'
  const [oilPeriod, setOilPeriod] = useState('monthly'); // 'weekly' or 'monthly'
  const [showFilters, setShowFilters] = useState(true);

  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const daysAgo = fuelPeriod === 'weekly' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const fromDate = startDate.toISOString().split('T')[0];

    try {
      const [pricesRes, suppliersRes, baseCitiesRes, settingsRes, oilRes] = await Promise.all([
        supabase.from('daily_prices').select('date, supplier_id, base_city_id, prices').eq('user_id', user.id).gte('date', fromDate),
        supabase.from('suppliers').select('id, name, city_ids').eq('user_id', user.id),
        supabase.from('cities').select('id, name').eq('user_id', user.id),
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
        supabase.from('oil_prices').select('date, wti_price, brent_price').gte('date', fromDate),
      ]);

      if (pricesRes.error) throw pricesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (oilRes.error) throw oilRes.error;
      
      const userSettings = settingsRes.data?.settings || defaultSettings;
      const currentFuelTypes = userSettings.fuelTypes || {};
      
      // Initialize selected fuels if empty
      if (selectedFuels.length === 0 && Object.keys(currentFuelTypes).length > 0) {
        setSelectedFuels([Object.keys(currentFuelTypes)[0]]);
      }
      
      // Initialize selected suppliers if empty
      if (selectedSuppliers.length === 0 && (suppliersRes.data || []).length > 0) {
        setSelectedSuppliers((suppliersRes.data || []).map(s => s.id));
      }

      setSuppliers(suppliersRes.data || []);
      
      // Filtrar apenas cidades que são bases (city_ids dos fornecedores)
      const supplierCityIds = new Set();
      (suppliersRes.data || []).forEach(supplier => {
        (supplier.city_ids || []).forEach(cityId => supplierCityIds.add(cityId));
      });
      const onlyBaseCities = (baseCitiesRes.data || []).filter(city => supplierCityIds.has(city.id));
      
      console.log('🏙️ Base Cities Debug:', {
        allCities: baseCitiesRes.data?.length,
        supplierCityIds: Array.from(supplierCityIds),
        onlyBaseCities: onlyBaseCities.map(c => c.name)
      });
      
      setBaseCities(onlyBaseCities);
      setSettings(userSettings);
      setOilPrices(oilRes.data || []);

      // Flatten all prices for selected fuels and suppliers
      const relevantPrices = [];
      pricesRes.data.forEach(priceRecord => {
        // Filtrar por base se não for "all"
        if (selectedBase !== 'all' && priceRecord.base_city_id !== selectedBase) {
          return;
        }
        
        if (priceRecord.prices) {
          Object.keys(priceRecord.prices).forEach(fuelKey => {
            if (priceRecord.prices[fuelKey]) {
              relevantPrices.push({
                date: priceRecord.date,
                supplier_id: priceRecord.supplier_id,
                base_city_id: priceRecord.base_city_id,
                fuel_type: fuelKey,
                price: priceRecord.prices[fuelKey]
              });
            }
          });
        }
      });
      setDbData(relevantPrices);

    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError(`Não foi possível buscar os dados históricos. Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, selectedFuels, selectedSuppliers, selectedBase, fuelPeriod]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);
  
  const fuelPriceChartData = useMemo(() => {
      if (!dbData.length || !suppliers.length || selectedFuels.length === 0 || selectedSuppliers.length === 0) return [];
      
      const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
      
      // Filter by selected suppliers and fuels
      const filteredData = dbData.filter(item => 
        selectedSuppliers.includes(item.supplier_id) && 
        selectedFuels.includes(item.fuel_type)
      );
      
      const pricesByDate = filteredData.reduce((acc, item) => {
          const date = new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
          const supplierName = supplierMap.get(item.supplier_id);
          const fuelName = fuelTypes[item.fuel_type]?.name || item.fuel_type;
          
          if (!supplierName) return acc;
          
          if (!acc[date]) {
              acc[date] = { date };
          }
          
          // Label: "Fornecedor - Combustível"
          const label = `${supplierName} - ${fuelName}`;
          acc[date][label] = item.price;
          
          return acc;
      }, {});
      
      return Object.values(pricesByDate).sort((a,b) => new Date(a.date.split('/').reverse().join('-')) - new Date(b.date.split('/').reverse().join('-')));
  }, [dbData, suppliers, selectedFuels, selectedSuppliers, fuelTypes]);


  const oilPriceChartData = useMemo(() => {
    // Filter by oil period
    const daysAgo = oilPeriod === 'weekly' ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    
    return oilPrices
      .filter(p => new Date(p.date) >= cutoffDate)
      .map(p => ({
        date: new Date(p.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
        'Petróleo WTI': p.wti_price,
        'Petróleo BRENT': p.brent_price,
      }))
      .sort((a,b) => new Date(a.date.split('/').reverse().join('-')) - new Date(b.date.split('/').reverse().join('-')));
  }, [oilPrices, oilPeriod]);
  
  const getLineNames = (data) => {
    if (data.length === 0) return [];
    const names = new Set();
    data.forEach(d => {
      Object.keys(d).forEach(key => { if (key !== 'date') names.add(key); });
    });
    return Array.from(names);
  }

  const fuelLineNames = getLineNames(fuelPriceChartData);
  const oilLineNames = getLineNames(oilPriceChartData);

  const renderChart = (title, icon, data, lineNames, tooltipCurrency, noDataMessage) => (
    <div className="glass-effect rounded-xl p-6 shadow-sm flex flex-col border overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="h-[450px] w-full">
        {loading && <div className="flex justify-center items-center h-full"><RefreshCw className="w-12 h-12 text-primary animate-spin" /></div>}
        {!loading && error && <div className="flex flex-col justify-center items-center h-full text-destructive"><AlertTriangle className="w-12 h-12 mb-4" /><p className="font-semibold">{error}</p></div>}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 30, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(value) => `${tooltipCurrency === 'BRL' ? 'R$' : '$'}${Number(value).toFixed(2)}`} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
              <Tooltip content={<CustomTooltip currency={tooltipCurrency} />} />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: '10px',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '12px'
                }}
                iconType="line"
                layout="horizontal"
                verticalAlign="bottom"
              />
              {lineNames.map((name, index) => (
                <Line key={name} type="monotone" dataKey={name} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
            <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
                <LineChartIcon className="w-12 h-12 mb-4" />
                <p className="font-semibold">{noDataMessage.title}</p>
                <p className="text-sm">{noDataMessage.subtitle}</p>
            </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LineChartIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Análise Histórica</h1>
            <p className="text-muted-foreground">Evolução de preços - Compare fornecedores e combustíveis</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
          {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
        </Button>
      </div>
      
      {/* Filtros (colapsáveis) */}
      {showFilters && (
      <div className="bg-card border rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Fuel className="w-5 h-5" />
          Filtros de Análise
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Filtro de Base */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Base de Carregamento</Label>
            <Select value={selectedBase} onValueChange={setSelectedBase}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a base..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Bases</SelectItem>
                {baseCities.map((base) => (
                  <SelectItem key={base.id} value={base.id}>{base.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Filtra os preços por cidade base de origem
            </p>
          </div>

          {/* Filtro de Fornecedores */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Fornecedores</Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="select-all-suppliers"
                  checked={selectedSuppliers.length === suppliers.length}
                  onCheckedChange={(checked) => {
                    setSelectedSuppliers(checked ? suppliers.map(s => s.id) : []);
                  }}
                />
                <label htmlFor="select-all-suppliers" className="text-sm font-medium">
                  Selecionar Todos
                </label>
              </div>
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`supplier-${supplier.id}`}
                    checked={selectedSuppliers.includes(supplier.id)}
                    onCheckedChange={(checked) => {
                      setSelectedSuppliers(prev =>
                        checked
                          ? [...prev, supplier.id]
                          : prev.filter(id => id !== supplier.id)
                      );
                    }}
                  />
                  <label htmlFor={`supplier-${supplier.id}`} className="text-sm">
                    {supplier.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Filtro de Combustíveis */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Combustíveis</Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="select-all-fuels"
                  checked={selectedFuels.length === Object.keys(fuelTypes).length}
                  onCheckedChange={(checked) => {
                    setSelectedFuels(checked ? Object.keys(fuelTypes) : []);
                  }}
                />
                <label htmlFor="select-all-fuels" className="text-sm font-medium">
                  Selecionar Todos
                </label>
              </div>
              {Object.entries(fuelTypes).map(([key, fuel]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`fuel-${key}`}
                    checked={selectedFuels.includes(key)}
                    onCheckedChange={(checked) => {
                      setSelectedFuels(prev =>
                        checked
                          ? [...prev, key]
                          : prev.filter(k => k !== key)
                      );
                    }}
                  />
                  <label htmlFor={`fuel-${key}`} className="text-sm">
                    {fuel.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seletores de Período */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm">Período Combustível:</Label>
            <Select value={fuelPeriod} onValueChange={setFuelPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal (7d)</SelectItem>
                <SelectItem value="monthly">Mensal (30d)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm">Período Petróleo:</Label>
            <Select value={oilPeriod} onValueChange={setOilPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal (7d)</SelectItem>
                <SelectItem value="monthly">Mensal (30d)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          {renderChart(
              `Preços de Combustível por Fornecedor${selectedBase !== 'all' ? ` - ${baseCities.find(b => b.id === selectedBase)?.name || ''}` : ' - Todas as Bases'}`,
              <Fuel className="w-6 h-6 text-primary" />,
              fuelPriceChartData,
              fuelLineNames,
              'BRL',
              { title: 'Nenhum dado de combustível encontrado.', subtitle: 'Verifique se há preços inseridos para os filtros selecionados.' }
          )}
        </div>
        <div>
            {renderChart(
              'Preços do Petróleo Internacional',
              <TrendingUp className="w-6 h-6 text-primary" />,
              oilPriceChartData,
              oilLineNames,
              'USD',
              { title: 'Nenhum dado de petróleo encontrado.', subtitle: 'Os dados do petróleo são salvos diariamente.' }
            )}
        </div>
      </div>

      <AverageFuelPricesChart />
    </motion.div>
  );
};

export default Analysis;
