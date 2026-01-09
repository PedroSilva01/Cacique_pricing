
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, AlertTriangle, LineChart as LineChartIcon, BarChart3, Fuel, TrendingUp, Calendar, MapPin, Users, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { computePearsonCorrelation } from '@/lib/analytics';
import { useDashboardData } from '@/hooks/useDashboardData';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#64748b', '#f59e0b', '#34d399', '#a78bfa'];

const PERIOD_OPTIONS = {
  weekly: { days: 7, label: 'Semanal (7d)' },
  monthly: { days: 30, label: 'Mensal (30d)' },
  bimonthly: { days: 60, label: 'Bimestral (60d)' },
  quarterly: { days: 90, label: 'Trimestral (90d)' },
  semiannual: { days: 180, label: 'Semestral (180d)' },
  annual: { days: 365, label: 'Anual (365d)' },
};

const FilterCard = ({ icon: Icon, title, description, children, className = '', isCollapsed, onToggleCollapse }) => {
  return (
    <div className={`rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 shadow-md p-4 space-y-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 p-2.5 shadow-lg">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h3>
            {description ? <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{description}</p> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          )}
        </button>
      </div>
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [oilPrices, setOilPrices] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuelBase, setFuelBase] = useState('all');
  const [fuelSuppliers, setFuelSuppliers] = useState([]);
  const [fuelFuels, setFuelFuels] = useState([]);
  const [fuelGroups, setFuelGroups] = useState([]);

  const [variationBase, setVariationBase] = useState('all');
  const [variationSuppliers, setVariationSuppliers] = useState([]);
  const [variationFuels, setVariationFuels] = useState([]);
  const [variationPeriod, setVariationPeriod] = useState('monthly');
  const [variationGroups, setVariationGroups] = useState([]);
  const [selectedBrands, setSelectedBrands] = useState([]);

  const [fuelPeriod, setFuelPeriod] = useState('monthly');
  const [oilPeriod, setOilPeriod] = useState('monthly');

  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const {
    loading: refDataLoading,
    settings,
    suppliers,
    baseCities,
    groups,
  } = useDashboardData(userId, {
    onError: (err) => {
      console.error('Erro ao carregar dados de referência da análise:', err);
      setError(`Não foi possível buscar dados de referência. Erro: ${err.message}`);
      showErrorToast(toast, {
        title: 'Erro ao carregar dados',
        error: err,
        descriptionPrefix: 'Falha ao buscar dados de referência',
      });
    },
  });

  const fuelTypes = useMemo(() => settings?.fuelTypes || {}, [settings]);

  const loading = refDataLoading || localLoading;

  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ id: String(supplier.id), name: supplier.name })),
    [suppliers]
  );

  const baseOptions = useMemo(
    () => baseCities.map((base) => ({ id: String(base.id), name: base.name })),
    [baseCities]
  );

  const brandOptions = useMemo(
    () => {
      const map = new Map();
      suppliers.forEach((supplier) => {
        const value = supplier.bandeira || 'bandeira_branca';
        if (!map.has(value)) {
          const label = value
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          map.set(value, label);
        }
      });
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
    [suppliers]
  );

  const supplierBrandMap = useMemo(
    () => {
      const map = new Map();
      suppliers.forEach((supplier) => {
        map.set(String(supplier.id), supplier.bandeira || 'bandeira_branca');
      });
      return map;
    },
    [suppliers]
  );

  const fuelOptions = useMemo(
    () => Object.entries(fuelTypes).map(([key, fuel]) => ({ id: key, name: fuel?.name || key })),
    [fuelTypes]
  );

  const groupOptions = useMemo(
    () => groups.map((group) => ({ id: String(group.id), name: group.name })),
    [groups]
  );

  const fetchFuelData = useCallback(async () => {
    if (!userId) return;
    if (!settings || !suppliers || !baseCities || !groups) return;
    setLocalLoading(true);
    setError(null);

    const fuelDays = PERIOD_OPTIONS[fuelPeriod]?.days ?? PERIOD_OPTIONS.monthly.days;
    const variationDays = PERIOD_OPTIONS[variationPeriod]?.days ?? PERIOD_OPTIONS.monthly.days;
    const daysAgo = Math.max(fuelDays, variationDays);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const fromDate = startDate.toISOString().split('T')[0];

    try {
      const { data: pricesData, error: pricesError } = await supabase
        .from('daily_prices')
        .select('date, supplier_id, base_city_id, group_ids, prices')
        .eq('user_id', userId)
        .gte('date', fromDate);

      if (pricesError) throw pricesError;

      const userSettings = settings || {};
      const currentFuelTypes = userSettings.fuelTypes || {};
      const availableFuelKeys = Object.keys(currentFuelTypes);
      const supplierIds = (suppliers || []).map(s => String(s.id));
      const baseIds = (baseCities || []).map(b => String(b.id));
      const groupIds = (groups || []).map(g => String(g.id));

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

      setFuelGroups(prev => {
        const filtered = prev.filter(id => groupIds.includes(id));
        if (filtered.length > 0) return filtered;
        return groupIds;
      });

      setVariationGroups(prev => {
        const filtered = prev.filter(id => groupIds.includes(id));
        if (filtered.length > 0) return filtered;
        return groupIds;
      });

      // Flatten all prices para combustíveis/fornecedores/grupos
      const relevantPrices = [];
      (pricesData || []).forEach(priceRecord => {
        if (priceRecord.prices) {
          Object.keys(priceRecord.prices).forEach(fuelKey => {
            if (priceRecord.prices[fuelKey]) {
              relevantPrices.push({
                date: priceRecord.date,
                supplier_id: String(priceRecord.supplier_id),
                base_city_id: priceRecord.base_city_id != null ? String(priceRecord.base_city_id) : null,
                group_ids: Array.isArray(priceRecord.group_ids) ? priceRecord.group_ids.map((id) => String(id)) : [],
                fuel_type: fuelKey,
                price: priceRecord.prices[fuelKey]
              });
            }
          });
        }
      });
      setDbData(relevantPrices);

      try {
        if (typeof window !== 'undefined' && userId) {
          const storageKey = `analysis_filters_${userId}`;
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const saved = JSON.parse(raw);

            if (saved.fuelBase && (saved.fuelBase === 'all' || baseIds.includes(saved.fuelBase))) {
              setFuelBase(saved.fuelBase);
            }

            if (saved.variationBase && (saved.variationBase === 'all' || baseIds.includes(saved.variationBase))) {
              setVariationBase(saved.variationBase);
            }

            if (saved.fuelPeriod && PERIOD_OPTIONS[saved.fuelPeriod]) {
              setFuelPeriod(saved.fuelPeriod);
            }

            if (saved.variationPeriod && PERIOD_OPTIONS[saved.variationPeriod]) {
              setVariationPeriod(saved.variationPeriod);
            }

            if (saved.oilPeriod && PERIOD_OPTIONS[saved.oilPeriod]) {
              setOilPeriod(saved.oilPeriod);
            }

            if (Array.isArray(saved.fuelSuppliers)) {
              if (saved.fuelSuppliers.length > 0) {
                const valid = saved.fuelSuppliers.filter(id => supplierIds.includes(id));
                if (valid.length > 0) setFuelSuppliers(valid);
              } else {
                // If saved array is empty, initialize with all suppliers
                setFuelSuppliers(supplierIds);
              }
            }

            if (Array.isArray(saved.variationSuppliers)) {
              if (saved.variationSuppliers.length > 0) {
                const valid = saved.variationSuppliers.filter(id => supplierIds.includes(id));
                if (valid.length > 0) setVariationSuppliers(valid);
              } else {
                // If saved array is empty, initialize with all suppliers
                setVariationSuppliers(supplierIds);
              }
            }

            if (Array.isArray(saved.fuelFuels)) {
              if (saved.fuelFuels.length > 0) {
                const valid = saved.fuelFuels.filter(key => availableFuelKeys.includes(key));
                if (valid.length > 0) setFuelFuels(valid);
              } else {
                // If saved array is empty, initialize with all fuels
                setFuelFuels([...availableFuelKeys]);
              }
            }

            if (Array.isArray(saved.variationFuels)) {
              if (saved.variationFuels.length > 0) {
                const valid = saved.variationFuels.filter(key => availableFuelKeys.includes(key));
                if (valid.length > 0) setVariationFuels(valid);
              } else {
                // If saved array is empty, initialize with all fuels
                setVariationFuels([...availableFuelKeys]);
              }
            }

            if (Array.isArray(saved.fuelGroups)) {
              if (saved.fuelGroups.length > 0) {
                const valid = saved.fuelGroups.filter(id => groupIds.includes(id));
                if (valid.length > 0) setFuelGroups(valid);
              } else {
                // If saved array is empty, initialize with all groups
                setFuelGroups(groupIds);
              }
            }

            if (Array.isArray(saved.variationGroups)) {
              if (saved.variationGroups.length > 0) {
                const valid = saved.variationGroups.filter(id => groupIds.includes(id));
                if (valid.length > 0) setVariationGroups(valid);
              } else {
                // If saved array is empty, initialize with all groups
                setVariationGroups(groupIds);
              }
            }
          }
        }
      } catch (e) {
        console.error('Erro ao restaurar filtros da análise:', e);
      }

    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError(`Não foi possível buscar os dados históricos. Erro: ${err.message}`);
    } finally {
      setLocalLoading(false);
    }
  }, [userId, fuelPeriod, variationPeriod, settings, suppliers, baseCities, groups]);

  const fetchOilData = useCallback(async () => {
    if (!userId) return;

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
  }, [userId, oilPeriod]);

  useEffect(() => {
    if (userId) {
      fetchFuelData();
    }
  }, [userId, fetchFuelData]);

  useEffect(() => {
    if (userId) {
      fetchOilData();
    }
  }, [userId, fetchOilData]);

  const matchesGroupSelection = (itemGroups = [], selectedGroups = []) => {
    if (selectedGroups.length === 0) return true;
    if (!itemGroups || itemGroups.length === 0) return false;
    return itemGroups.some((groupId) => selectedGroups.includes(groupId));
  };

  const filteredFuelData = useMemo(() => {
    return dbData.filter(item => {
      const matchesBase = fuelBase === 'all' || item.base_city_id === fuelBase;
      const matchesSupplier = fuelSuppliers.length === 0 || fuelSuppliers.includes(item.supplier_id);
      const matchesFuel = fuelFuels.length === 0 || fuelFuels.includes(item.fuel_type);
      const matchesGroup = matchesGroupSelection(item.group_ids, fuelGroups);
      const brandValue = supplierBrandMap.get(item.supplier_id) || 'bandeira_branca';
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(brandValue);
      return matchesBase && matchesSupplier && matchesFuel && matchesGroup && matchesBrand;
    });
  }, [dbData, fuelBase, fuelSuppliers, fuelFuels, fuelGroups, supplierBrandMap, selectedBrands]);

  const filteredVariationData = useMemo(() => {
    return dbData.filter(item => {
      const matchesBase = variationBase === 'all' || item.base_city_id === variationBase;
      const matchesSupplier = variationSuppliers.length === 0 || variationSuppliers.includes(item.supplier_id);
      const matchesFuel = variationFuels.length === 0 || variationFuels.includes(item.fuel_type);
      const matchesGroup = matchesGroupSelection(item.group_ids, variationGroups);
      const brandValue = supplierBrandMap.get(item.supplier_id) || 'bandeira_branca';
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(brandValue);
      return matchesBase && matchesSupplier && matchesFuel && matchesGroup && matchesBrand;
    });
  }, [dbData, variationBase, variationSuppliers, variationFuels, variationGroups, supplierBrandMap, selectedBrands]);

  const fuelPriceChartData = useMemo(() => {
      if (!filteredFuelData.length || !suppliers.length) return [];
      
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
  
  const correlationMetrics = useMemo(() => {
    if (!filteredFuelData.length || !oilPrices.length) return null;

    const oilByDate = new Map();
    oilPrices.forEach((p) => {
      const value = Number(p.brent_price ?? p.wti_price);
      if (!Number.isFinite(value)) return;
      oilByDate.set(p.date, value);
    });

    const aggregated = new Map();
    filteredFuelData.forEach((item) => {
      const oil = oilByDate.get(item.date);
      if (oil == null) return;
      const price = Number(item.price);
      if (!Number.isFinite(price)) return;
      if (!aggregated.has(item.date)) {
        aggregated.set(item.date, { sum: 0, count: 0, oil });
      }
      const entry = aggregated.get(item.date);
      entry.sum += price;
      entry.count += 1;
    });

    const points = [];
    aggregated.forEach(({ sum, count, oil }) => {
      if (!count) return;
      const avg = sum / count;
      if (!Number.isFinite(avg)) return;
      points.push({ oil, price: avg });
    });

    if (points.length < 3) return null;

    return computePearsonCorrelation(points, {
      xKey: 'oil',
      yKey: 'price',
      minPoints: 3,
    });
  }, [filteredFuelData, oilPrices]);
  
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
    if (!filteredVariationData.length || !suppliers.length) {
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
    <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
      <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <CardTitle className="flex items-center gap-2 text-xl">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
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
      </CardContent>
    </Card>
  );

  const renderChart = (title, icon, data, lineNames, tooltipCurrency, noDataMessage, filters = null) => (
    <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
      <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardTitle className="flex items-center gap-2 text-xl">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
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
            <div className="flex flex-col justify-center items-center h-full text-muted-foreground space-y-2">
                <LineChartIcon className="w-12 h-12 mb-2" />
                <p className="font-semibold">{noDataMessage.title}</p>
                <p className="text-sm text-center">{noDataMessage.subtitle}</p>
                <p className="text-xs text-center text-muted-foreground/80">Verifique se os grupos selecionados possuem preços registrados no período.</p>
            </div>
        )}
      </div>
      </CardContent>
    </Card>
  );

  const fuelBaseLabel = fuelBase !== 'all' ? baseOptions.find((b) => b.id === fuelBase)?.name : null;
  const variationBaseLabel = variationBase !== 'all' ? baseOptions.find((b) => b.id === variationBase)?.name : null;
  const fuelChartTitle = fuelBaseLabel
    ? `Preços de Combustível por Fornecedor - ${fuelBaseLabel}`
    : 'Preços de Combustível por Fornecedor - Todas as Bases';
  const variationChartTitle = variationBaseLabel
    ? `Ranking de Variação de Preços - ${variationBaseLabel}`
    : 'Ranking de Variação de Preços';

  const handleResetFuelFilters = () => {
    setFuelBase('all');
    setFuelPeriod('monthly');
    setFuelSuppliers([]);
    setFuelFuels([]);
    setFuelGroups([]);
  };

  const handleResetVariationFilters = () => {
    setVariationBase('all');
    setVariationPeriod('monthly');
    setVariationSuppliers([]);
    setVariationFuels([]);
    setVariationGroups([]);
  };

  const handleResetOilFilters = () => {
    setOilPeriod('monthly');
  };

  useEffect(() => {
    if (!userId) return;
    try {
      if (typeof window === 'undefined') return;
      const storageKey = `analysis_filters_${userId}`;
      const payload = {
        fuelBase,
        variationBase,
        fuelPeriod,
        variationPeriod,
        oilPeriod,
        fuelSuppliers,
        variationSuppliers,
        fuelFuels,
        variationFuels,
        fuelGroups,
        variationGroups,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) {
      console.error('Erro ao salvar filtros da análise:', e);
    }
  }, [userId, fuelBase, variationBase, fuelPeriod, variationPeriod, oilPeriod, fuelSuppliers, variationSuppliers, fuelFuels, variationFuels, fuelGroups, variationGroups]);

  const buildSupplierCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-suppliers-all`}
            checked={options.length > 0 && selected.length === options.length}
            disabled={options.length === 0}
            onCheckedChange={(checked) => {
              if (options.length === 0) return;
              if (checked === true) {
                setSelected(options.map((opt) => opt.id));
              } else {
                setSelected([]);
              }
            }}
          />
          <label htmlFor={`${idPrefix}-suppliers-all`} className="text-xs font-medium uppercase tracking-wide">
            Selecionar todos
          </label>
        </div>
        <span className="text-[10px] text-muted-foreground">{selected.length}/{options.length}</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhum fornecedor cadastrado.</p>
      ) : (
        options.map((option) => (
          <div key={option.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
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
        ))
      )}
    </div>
  );

  const buildFuelCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-fuels-all`}
            checked={options.length > 0 && selected.length === options.length}
            disabled={options.length === 0}
            onCheckedChange={(checked) => {
              if (options.length === 0) return;
              if (checked === true) {
                setSelected(options.map((opt) => opt.id));
              } else {
                setSelected([]);
              }
            }}
          />
          <label htmlFor={`${idPrefix}-fuels-all`} className="text-xs font-medium uppercase tracking-wide">
            Selecionar todos
          </label>
        </div>
        <span className="text-[10px] text-muted-foreground">{selected.length}/{options.length}</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhum combustível disponível.</p>
      ) : (
        options.map((option) => (
          <div key={option.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
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
        ))
      )}
    </div>
  );

  const buildBrandCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-brands-all`}
            checked={options.length > 0 && selected.length === options.length}
            disabled={options.length === 0}
            onCheckedChange={(checked) => {
              if (options.length === 0) return;
              if (checked === true) {
                setSelected(options.map((opt) => opt.id));
              } else {
                setSelected([]);
              }
            }}
          />
          <label htmlFor={`${idPrefix}-brands-all`} className="text-xs font-medium uppercase tracking-wide">
            Selecionar todos
          </label>
        </div>
        <span className="text-[10px] text-muted-foreground">{selected.length}/{options.length}</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma bandeira encontrada.</p>
      ) : (
        options.map((option) => (
          <div key={option.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
            <Checkbox
              id={`${idPrefix}-brand-${option.id}`}
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
            <label htmlFor={`${idPrefix}-brand-${option.id}`} className="text-sm">
              {option.name}
            </label>
          </div>
        ))
      )}
    </div>
  );

  const buildGroupCheckboxes = (options, selected, setSelected, idPrefix) => (
    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-groups-all`}
            checked={options.length > 0 && selected.length === options.length}
            disabled={options.length === 0}
            onCheckedChange={(checked) => {
              if (options.length === 0) return;
              if (checked === true) {
                setSelected(options.map((opt) => opt.id));
              } else {
                setSelected([]);
              }
            }}
          />
          <label htmlFor={`${idPrefix}-groups-all`} className="text-xs font-medium uppercase tracking-wide">
            Selecionar todos
          </label>
        </div>
        <span className="text-[10px] text-muted-foreground">{selected.length}/{options.length}</span>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhum grupo encontrado.</p>
      ) : (
        options.map((option) => (
          <div key={option.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
            <Checkbox
              id={`${idPrefix}-group-${option.id}`}
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
            <label htmlFor={`${idPrefix}-group-${option.id}`} className="text-sm">
              {option.name}
            </label>
          </div>
        ))
      )}
    </div>
  );

  const [variationFiltersExpanded, setVariationFiltersExpanded] = useState(true);
  const [fuelFiltersExpanded, setFuelFiltersExpanded] = useState(true);
  const [oilFiltersExpanded, setOilFiltersExpanded] = useState(true);

  const variationFilters = (
    <div className="space-y-4">
      <div 
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent/50 p-2 rounded"
        onClick={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
      >
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-foreground">Resumo dos filtros:</span>
          <span>
            {variationBase === 'all'
              ? 'Base: Todas'
              : `Base: ${variationBaseLabel || 'Selecionada'}`}
            {' · '}
            {`Período: ${PERIOD_OPTIONS[variationPeriod]?.label ?? 'Mensal (30d)'}`}
            {' · '}
            {`Fornecedores: ${variationSuppliers.length || 'todos'}`}
            {' · '}
            {`Combustíveis: ${variationFuels.length || 'todos'}`}
            {' · '}
            {`Grupos: ${variationGroups.length || 'todos'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleResetVariationFilters}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Limpar filtros
        </button>
      </div>

      {variationFiltersExpanded && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterCard
            icon={MapPin}
            title="Escopo da Análise"
            description="Escolha a base de origem e o período utilizado no ranking."
            isCollapsed={!variationFiltersExpanded}
            onToggleCollapse={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
            className="min-w-[220px]"
          >
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base de carregamento</Label>
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</Label>
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
          </FilterCard>

        <FilterCard
          icon={Users}
          title="Fornecedores"
          description="Selecione quais fornecedores terão suas variações comparadas."
          className="min-w-[220px]"
          isCollapsed={!variationFiltersExpanded}
          onToggleCollapse={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
        >
          {buildSupplierCheckboxes(supplierOptions, variationSuppliers, setVariationSuppliers, 'variation')}
        </FilterCard>

        <FilterCard
          icon={Users}
          title="Bandeiras"
          description="Filtre fornecedores por bandeira."
          className="min-w-[220px]"
          isCollapsed={!variationFiltersExpanded}
          onToggleCollapse={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
        >
          {buildBrandCheckboxes(brandOptions, selectedBrands, setSelectedBrands, 'variation-brands')}
        </FilterCard>

        <FilterCard
          icon={Fuel}
          title="Combustíveis"
          description="Defina os combustíveis considerados no ranking."
          className="min-w-[220px]"
          isCollapsed={!variationFiltersExpanded}
          onToggleCollapse={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
        >
          {buildFuelCheckboxes(fuelOptions, variationFuels, setVariationFuels, 'variation')}
        </FilterCard>

        <FilterCard
          icon={Layers}
          title="Grupos de Postos"
          description="Filtre os grupos que recebem o preço do fornecedor."
          className="min-w-[220px]"
          isCollapsed={!variationFiltersExpanded}
          onToggleCollapse={() => setVariationFiltersExpanded(!variationFiltersExpanded)}
        >
          {buildGroupCheckboxes(groupOptions, variationGroups, setVariationGroups, 'variation')}
          <p className="text-xs text-muted-foreground">Somente registros vinculados aos grupos selecionados entram no cálculo.</p>
        </FilterCard>
      </div>
      )}
    </div>
          );

  const fuelFilters = (
    <div className="space-y-4">
      <div 
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent/50 p-2 rounded"
        onClick={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
      >
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-foreground">Resumo dos filtros:</span>
          <span>
            {fuelBase === 'all'
              ? 'Base: Todas'
              : `Base: ${fuelBaseLabel || 'Selecionada'}`}
            {' · '}
            {`Período: ${PERIOD_OPTIONS[fuelPeriod]?.label ?? 'Mensal (30d)'}`}
            {' · '}
            {`Fornecedores: ${fuelSuppliers.length || 'todos'}`}
            {' · '}
            {`Combustíveis: ${fuelFuels.length || 'todos'}`}
            {' · '}
            {`Grupos: ${fuelGroups.length || 'todos'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleResetFuelFilters}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Limpar filtros
        </button>
      </div>

      {fuelFiltersExpanded && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterCard
            icon={MapPin}
            title="Escopo da Série"
            description="Escolha a base e o período para montar a série histórica do gráfico."
            isCollapsed={!fuelFiltersExpanded}
            onToggleCollapse={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
            className="min-w-[220px]"
          >
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base de carregamento</Label>
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</Label>
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
          </FilterCard>

        <FilterCard
          icon={Users}
          title="Fornecedores"
          description="Compare a evolução de preço entre diferentes fornecedores."
          className="min-w-[220px]"
          isCollapsed={!fuelFiltersExpanded}
          onToggleCollapse={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
        >
          {buildSupplierCheckboxes(supplierOptions, fuelSuppliers, setFuelSuppliers, 'fuel')}
        </FilterCard>

        <FilterCard
          icon={Users}
          title="Bandeiras"
          description="Limite os fornecedores pela bandeira de origem."
          className="min-w-[220px]"
          isCollapsed={!fuelFiltersExpanded}
          onToggleCollapse={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
        >
          {buildBrandCheckboxes(brandOptions, selectedBrands, setSelectedBrands, 'fuel-brands')}
        </FilterCard>

        <FilterCard
          icon={Fuel}
          title="Combustíveis"
          description="Selecione os combustíveis visíveis no gráfico."
          className="min-w-[220px]"
          isCollapsed={!fuelFiltersExpanded}
          onToggleCollapse={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
        >
          {buildFuelCheckboxes(fuelOptions, fuelFuels, setFuelFuels, 'fuel')}
        </FilterCard>

        <FilterCard
          icon={Layers}
          title="Grupos de Postos"
          description="Mostre apenas os registros aplicados aos grupos desejados."
          className="sm:col-span-2 xl:col-span-1 min-w-[220px]"
          isCollapsed={!fuelFiltersExpanded}
          onToggleCollapse={() => setFuelFiltersExpanded(!fuelFiltersExpanded)}
        >
          {buildGroupCheckboxes(groupOptions, fuelGroups, setFuelGroups, 'fuel')}
          <p className="text-xs text-muted-foreground">Os pontos exibidos consideram exclusivamente os grupos selecionados.</p>
        </FilterCard>
      </div>
      )}
    </div>);

  const oilFilters = (
    <div className="space-y-3">
      <div 
        className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground cursor-pointer hover:bg-accent/50 p-2 rounded"
        onClick={() => setOilFiltersExpanded(!oilFiltersExpanded)}
      >
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-foreground">Resumo do período:</span>
          <span>{PERIOD_OPTIONS[oilPeriod]?.label ?? 'Mensal (30d)'}</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleResetOilFilters();
          }}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Redefinir período
        </button>
      </div>
      {oilFiltersExpanded && (
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
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
          <div className="relative p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-2xl shadow-2xl">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">Análise de Preços</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">Acompanhe a evolução e correlação dos preços de combustíveis</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto space-y-6">
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

        {correlationMetrics && (
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Correlação preços x petróleo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Correlação de Pearson entre o preço médio filtrado e o preço do petróleo:{' '}
                <span className="font-bold text-lg text-green-600 dark:text-green-400">
                  r = {correlationMetrics.r.toFixed(2)}
                </span>{' '}
                ({correlationMetrics.strength} {correlationMetrics.direction}) com {correlationMetrics.points} ponto(s) no período.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

export default Analysis;
