
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, AlertTriangle, LineChart as LineChartIcon, Fuel, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from 'lucide-react';
import { defaultSettings } from '@/lib/mockData';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#64748b', '#f59e0b', '#34d399', '#a78bfa'];

const PERIOD_OPTIONS = {
  weekly: { days: 7, label: 'Semanal (7d)' },
  monthly: { days: 30, label: 'Mensal (30d)' },
  bimonthly: { days: 60, label: 'Bimestral (60d)' },
  quarterly: { days: 90, label: 'Trimestral (90d)' },
  semiannual: { days: 180, label: 'Semestral (180d)' },
  annual: { days: 365, label: 'Anual (365d)' },
};

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
  const [fuelBase, setFuelBase] = useState('all');
  const [fuelSuppliers, setFuelSuppliers] = useState([]);
  const [fuelFuels, setFuelFuels] = useState([]);

  const [variationBase, setVariationBase] = useState('all');
  const [variationSuppliers, setVariationSuppliers] = useState([]);
  const [variationFuels, setVariationFuels] = useState([]);
  const [variationPeriod, setVariationPeriod] = useState('monthly');

  const [fuelPeriod, setFuelPeriod] = useState('monthly');
  const [oilPeriod, setOilPeriod] = useState('monthly');

  const { user } = useAuth();

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ id: String(supplier.id), name: supplier.name })),
    [suppliers]
  );

  const baseOptions = useMemo(
    () => baseCities.map((base) => ({ id: String(base.id), name: base.name })),
    [baseCities]
  );

  const fuelOptions = useMemo(
    () => Object.entries(fuelTypes).map(([key, fuel]) => ({ id: key, name: fuel?.name || key })),
    [fuelTypes]
  );

  const fetchFuelData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const fuelDays = PERIOD_OPTIONS[fuelPeriod]?.days ?? PERIOD_OPTIONS.monthly.days;
    const variationDays = PERIOD_OPTIONS[variationPeriod]?.days ?? PERIOD_OPTIONS.monthly.days;
    const daysAgo = Math.max(fuelDays, variationDays);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const fromDate = startDate.toISOString().split('T')[0];

    try {
      const [pricesRes, suppliersRes, baseCitiesRes, settingsRes] = await Promise.all([
        supabase.from('daily_prices').select('date, supplier_id, base_city_id, prices').eq('user_id', user.id).gte('date', fromDate),
        supabase.from('suppliers').select('id, name, city_ids').eq('user_id', user.id),
        supabase.from('base_cities').select('id, name').eq('user_id', user.id).order('name'),
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
      ]);

      if (pricesRes.error) throw pricesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

      const userSettings = settingsRes.data?.settings || defaultSettings;
      const currentFuelTypes = userSettings.fuelTypes || {};
      const availableFuelKeys = Object.keys(currentFuelTypes);
      const supplierIds = (suppliersRes.data || []).map(s => String(s.id));
      const baseIds = (baseCitiesRes.data || []).map(b => String(b.id));

      setFuelFuels(prev => {
        const filtered = prev.filter(key => availableFuelKeys.includes(key));
        if (filtered.length > 0) return filtered;
        if (availableFuelKeys.length > 0) return [...availableFuelKeys];
        return [];
      });

      setVariationFuels(prev => {
        const filtered = prev.filter(key => availableFuelKeys.includes(key));
        if (filtered.length > 0) return filtered;
        if (availableFuelKeys.length > 0) return [...availableFuelKeys];
        return [];
      });

      setFuelSuppliers(prev => {
        const filtered = prev.filter(id => supplierIds.includes(id));
        if (filtered.length > 0) return filtered;
        return supplierIds;
      });

      setVariationSuppliers(prev => {
        const filtered = prev.filter(id => supplierIds.includes(id));
        if (filtered.length > 0) return filtered;
        return supplierIds;
      });

      setFuelBase(prev => {
        if (prev === 'all' || baseIds.includes(prev)) return prev;
        return 'all';
      });

      setVariationBase(prev => {
        if (prev === 'all' || baseIds.includes(prev)) return prev;
        return 'all';
      });

      setSuppliers((suppliersRes.data || []).map((supplier) => ({ ...supplier, id: String(supplier.id) })));

      setBaseCities((baseCitiesRes.data || []).map((base) => ({ ...base, id: String(base.id) })));
      setSettings(userSettings);

      // Flatten all prices for selected fuels and suppliers
      const relevantPrices = [];
      pricesRes.data.forEach(priceRecord => {
        if (priceRecord.prices) {
          Object.keys(priceRecord.prices).forEach(fuelKey => {
            if (priceRecord.prices[fuelKey]) {
              relevantPrices.push({
                date: priceRecord.date,
                supplier_id: String(priceRecord.supplier_id),
                base_city_id: priceRecord.base_city_id != null ? String(priceRecord.base_city_id) : null,
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
  }, [user, fuelPeriod, variationPeriod]);

  const fetchOilData = useCallback(async () => {
    if (!user) return;

    const periodConfig = PERIOD_OPTIONS[oilPeriod] || PERIOD_OPTIONS.monthly;
    const daysAgo = periodConfig.days;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const fromDate = startDate.toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('oil_prices')
        .select('date, wti_price, brent_price')
        .gte('date', fromDate);

      if (error) throw error;
      setOilPrices(data || []);
    } catch (err) {
      console.error('Erro ao carregar preços do petróleo:', err);
      setOilPrices([]);
    }
  }, [user, oilPeriod]);

  useEffect(() => {
    if (user) {
      fetchFuelData();
    }
  }, [user, fetchFuelData]);

  useEffect(() => {
    if (user) {
      fetchOilData();
    }
  }, [user, fetchOilData]);

  const filteredFuelData = useMemo(() => {
    return dbData.filter(item => {
      const matchesBase = fuelBase === 'all' || item.base_city_id === fuelBase;
      const matchesSupplier = fuelSuppliers.length === 0 || fuelSuppliers.includes(item.supplier_id);
      const matchesFuel = fuelFuels.length === 0 || fuelFuels.includes(item.fuel_type);
      return matchesBase && matchesSupplier && matchesFuel;
    });
  }, [dbData, fuelBase, fuelSuppliers, fuelFuels]);

  const filteredVariationData = useMemo(() => {
    return dbData.filter(item => {
      const matchesBase = variationBase === 'all' || item.base_city_id === variationBase;
      const matchesSupplier = variationSuppliers.length === 0 || variationSuppliers.includes(item.supplier_id);
      const matchesFuel = variationFuels.length === 0 || variationFuels.includes(item.fuel_type);
      return matchesBase && matchesSupplier && matchesFuel;
    });
  }, [dbData, variationBase, variationSuppliers, variationFuels]);

  const fuelPriceChartData = useMemo(() => {
      if (!filteredFuelData.length || !suppliers.length || fuelFuels.length === 0 || fuelSuppliers.length === 0) return [];
      
      const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
      
      const pricesByDate = filteredFuelData.reduce((acc, item) => {
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
  }, [filteredFuelData, suppliers, fuelFuels, fuelSuppliers, fuelTypes]);


  const oilPriceChartData = useMemo(() => {
    const periodConfig = PERIOD_OPTIONS[oilPeriod] || PERIOD_OPTIONS.monthly;
    const daysAgo = periodConfig.days;
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

  const variationRankingData = useMemo(() => {
    if (!filteredVariationData.length || !suppliers.length || variationFuels.length === 0 || variationSuppliers.length === 0) {
      return [];
    }

    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
    const grouped = new Map();

    const periodConfig = PERIOD_OPTIONS[variationPeriod] || PERIOD_OPTIONS.monthly;
    const daysAgo = periodConfig.days;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    filteredVariationData.forEach((item) => {
      const itemDate = new Date(item.date);
      if (itemDate < cutoffDate) {
        return;
      }

      const supplierName = supplierMap.get(item.supplier_id);
      if (!supplierName) return;

      const fuelName = fuelTypes[item.fuel_type]?.name || item.fuel_type;
      const key = `${supplierName} - ${fuelName}`;
      const price = Number(item.price);
      if (!Number.isFinite(price)) return;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push({ date: item.date, price });
    });

    const variationData = Array.from(grouped.entries()).map(([label, entries]) => {
      const ordered = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstPrice = ordered[0]?.price;
      const lastPrice = ordered[ordered.length - 1]?.price;

      if (!Number.isFinite(firstPrice) || !Number.isFinite(lastPrice) || firstPrice === 0) {
        return null;
      }

      const variation = ((lastPrice - firstPrice) / firstPrice) * 100;
      return {
        label,
        variation,
      };
    }).filter(Boolean);

    return variationData.sort((a, b) => b.variation - a.variation);
  }, [filteredVariationData, suppliers, variationFuels, variationSuppliers, variationPeriod, fuelTypes]);

  const formatVariation = (value) => {
    if (!Number.isFinite(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const renderVariationRankingChart = (title, filters = null) => (
    <div className="glass-effect rounded-xl p-6 shadow-sm flex flex-col border overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      {filters && <div className="space-y-4 mb-6">{filters}</div>}
      <div className="h-[400px] w-full">
        {loading && <div className="flex justify-center items-center h-full"><RefreshCw className="w-12 h-12 text-primary animate-spin" /></div>}
        {!loading && error && (
          <div className="flex flex-col justify-center items-center h-full text-destructive">
            <AlertTriangle className="w-12 h-12 mb-4" />
            <p className="font-semibold">{error}</p>
          </div>
        )}
        {!loading && !error && variationRankingData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={variationRankingData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={formatVariation}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={220}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const value = payload[0].value;
                  return (
                    <div className="glass-effect rounded-lg p-4 border shadow-md bg-background/80 backdrop-blur-sm">
                      <p className="font-semibold text-foreground mb-2">{label}</p>
                      <p className="text-sm">Variação: {formatVariation(value)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="variation" radius={[6, 6, 6, 6]}>
                {variationRankingData.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={entry.variation >= 0 ? '#22c55e' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && variationRankingData.length === 0 && (
          <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
            <LineChartIcon className="w-12 h-12 mb-4" />
            <p className="font-semibold">Sem registros suficientes para calcular a variação.</p>
            <p className="text-sm">Verifique os filtros escolhidos ou o período selecionado.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderChart = (title, icon, data, lineNames, tooltipCurrency, noDataMessage, filters = null) => (
    <div className="glass-effect rounded-xl p-6 shadow-sm flex flex-col border overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      {filters && <div className="space-y-4 mb-6">{filters}</div>}
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

  const fuelBaseLabel = fuelBase !== 'all' ? baseOptions.find((b) => b.id === fuelBase)?.name : null;
  const variationBaseLabel = variationBase !== 'all' ? baseOptions.find((b) => b.id === variationBase)?.name : null;
  const fuelChartTitle = fuelBaseLabel
    ? `Preços de Combustível por Fornecedor - ${fuelBaseLabel}`
    : 'Preços de Combustível por Fornecedor - Todas as Bases';
  const variationChartTitle = variationBaseLabel
    ? `Ranking de Variação de Preços - ${variationBaseLabel}`
    : 'Ranking de Variação de Preços';

  const buildSupplierCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id={`${idPrefix}-suppliers-all`}
          checked={options.length > 0 && selected.length === options.length}
          onCheckedChange={(checked) => {
            if (checked === true) {
              setSelected(options.map((opt) => opt.id));
            } else {
              setSelected([]);
            }
          }}
        />
        <label htmlFor={`${idPrefix}-suppliers-all`} className="text-sm font-medium">
          Selecionar Todos
        </label>
      </div>
      {options.map((option) => (
        <div key={option.id} className="flex items-center space-x-2">
          <Checkbox
            id={`${idPrefix}-supplier-${option.id}`}
            checked={selected.includes(option.id)}
            onCheckedChange={(checked) => {
              setSelected((prev) => {
                if (checked === true) {
                  if (prev.includes(option.id)) return prev;
                  return [...prev, option.id];
                }
                return prev.filter((id) => id !== option.id);
              });
            }}
          />
          <label htmlFor={`${idPrefix}-supplier-${option.id}`} className="text-sm">
            {option.name}
          </label>
        </div>
      ))}
    </div>
  );

  const buildFuelCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
      <div className="flex items-center space-x-2 mb-2">
        <Checkbox
          id={`${idPrefix}-fuels-all`}
          checked={options.length > 0 && selected.length === options.length}
          onCheckedChange={(checked) => {
            if (checked === true) {
              setSelected(options.map((opt) => opt.id));
            } else {
              setSelected([]);
            }
          }}
        />
        <label htmlFor={`${idPrefix}-fuels-all`} className="text-sm font-medium">
          Selecionar Todos
        </label>
      </div>
      {options.map((option) => (
        <div key={option.id} className="flex items-center space-x-2">
          <Checkbox
            id={`${idPrefix}-fuel-${option.id}`}
            checked={selected.includes(option.id)}
            onCheckedChange={(checked) => {
              setSelected((prev) => {
                if (checked === true) {
                  if (prev.includes(option.id)) return prev;
                  return [...prev, option.id];
                }
                return prev.filter((id) => id !== option.id);
              });
            }}
          />
          <label htmlFor={`${idPrefix}-fuel-${option.id}`} className="text-sm">
            {option.name}
          </label>
        </div>
      ))}
    </div>
  );

  const variationFilters = (
    <div className="grid md:grid-cols-3 gap-4">
      <div>
        <Label className="text-sm font-medium mb-3 block">Base de Carregamento</Label>
        <Select value={variationBase} onValueChange={setVariationBase}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a base..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Bases</SelectItem>
            {baseOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium mb-3 block mt-4">Período</Label>
        <Select value={variationPeriod} onValueChange={setVariationPeriod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_OPTIONS).map(([key, option]) => (
              <SelectItem key={key} value={key}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium mb-3 block">Fornecedores</Label>
        {buildSupplierCheckboxes(supplierOptions, variationSuppliers, setVariationSuppliers, 'variation')}
      </div>
      <div>
        <Label className="text-sm font-medium mb-3 block">Combustíveis</Label>
        {buildFuelCheckboxes(fuelOptions, variationFuels, setVariationFuels, 'variation')}
      </div>
    </div>
  );

  const fuelFilters = (
    <div className="grid md:grid-cols-3 gap-4">
      <div>
        <Label className="text-sm font-medium mb-3 block">Base de Carregamento</Label>
        <Select value={fuelBase} onValueChange={setFuelBase}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a base..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Bases</SelectItem>
            {baseOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-sm font-medium mb-3 block mt-4">Período</Label>
        <Select value={fuelPeriod} onValueChange={setFuelPeriod}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_OPTIONS).map(([key, option]) => (
              <SelectItem key={key} value={key}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium mb-3 block">Fornecedores</Label>
        {buildSupplierCheckboxes(supplierOptions, fuelSuppliers, setFuelSuppliers, 'fuel')}
      </div>
      <div>
        <Label className="text-sm font-medium mb-3 block">Combustíveis</Label>
        {buildFuelCheckboxes(fuelOptions, fuelFuels, setFuelFuels, 'fuel')}
      </div>
    </div>
  );

  const oilFilters = (
    <div className="flex flex-wrap items-center gap-3">
      <Calendar className="w-4 h-4 text-muted-foreground" />
      <Label className="text-sm">Período</Label>
      <Select value={oilPeriod} onValueChange={setOilPeriod}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_OPTIONS).map(([key, option]) => (
            <SelectItem key={key} value={key}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center gap-3">
        <LineChartIcon className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Análise Histórica</h1>
          <p className="text-muted-foreground">Evolução de preços - Compare fornecedores e combustíveis</p>
        </div>
      </div>

      <div className="space-y-6">
        {renderChart(
          fuelChartTitle,
          <Fuel className="w-6 h-6 text-primary" />,
          fuelPriceChartData,
          fuelLineNames,
          'BRL',
          { title: 'Nenhum dado de combustível encontrado.', subtitle: 'Verifique se há preços inseridos para os filtros selecionados.' },
          fuelFilters
        )}

        {renderVariationRankingChart(
          variationChartTitle,
          variationFilters
        )}

        {renderChart(
          'Preços do Petróleo Internacional',
          <TrendingUp className="w-6 h-6 text-primary" />,
          oilPriceChartData,
          oilLineNames,
          'USD',
          { title: 'Nenhum dado de petróleo encontrado.', subtitle: 'Os dados do petróleo são salvos diariamente.' },
          oilFilters
        )}
      </div>
    </motion.div>
  );
}

export default Analysis;
