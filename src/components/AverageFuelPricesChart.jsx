import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { RefreshCw, TrendingUp, Droplets, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { defaultSettings } from '@/lib/mockData';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#64748b', '#f59e0b', '#34d399', '#a78bfa'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-effect rounded-lg p-4 border shadow-md bg-background/95 backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-2">{`Data: ${label}`}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-medium">
            {`${p.name}: R$ ${p.value.toFixed(4)}/L`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AverageFuelPricesChart = ({ selectedBase = 'all', baseCities = [] }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dailyPrices, setDailyPrices] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [period, setPeriod] = useState('weekly'); // 'weekly' or 'monthly'
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    
    try {
      const daysAgo = period === 'weekly' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const fromDate = startDate.toISOString().split('T')[0];

      const [pricesRes, settingsRes] = await Promise.all([
        supabase
          .from('daily_prices')
          .select('date, supplier_id, base_city_id, prices')
          .eq('user_id', userId)
          .gte('date', fromDate)
          .order('date', { ascending: true }),
        supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (pricesRes.error) throw pricesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

      const userSettings = settingsRes.data?.settings || defaultSettings;
      setSettings(userSettings);
      setDailyPrices(pricesRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, period]);

  const filteredDailyPrices = useMemo(() => {
    if (selectedBase === 'all') return dailyPrices;
    return dailyPrices.filter(item => item.base_city_id === selectedBase);
  }, [dailyPrices, selectedBase]);

  const chartData = useMemo(() => {
    if (!filteredDailyPrices.length) return [];

    const fuelTypes = settings.fuelTypes || {};
    
    // Group prices by date and calculate averages
    const dateMap = {};
    
    filteredDailyPrices.forEach(item => {
      const date = new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      if (!dateMap[date]) {
        dateMap[date] = {};
        Object.keys(fuelTypes).forEach(fuelKey => {
          dateMap[date][fuelKey] = { sum: 0, count: 0 };
        });
      }
      
      if (item.prices) {
        Object.keys(item.prices).forEach(fuelKey => {
          if (item.prices[fuelKey] && fuelTypes[fuelKey]) {
            dateMap[date][fuelKey].sum += item.prices[fuelKey];
            dateMap[date][fuelKey].count += 1;
          }
        });
      }
    });

    // Convert to chart format with averages
    const result = Object.entries(dateMap).map(([date, fuels]) => {
      const dataPoint = { date };
      
      Object.keys(fuelTypes).forEach(fuelKey => {
        if (fuels[fuelKey].count > 0) {
          dataPoint[fuelTypes[fuelKey].name] = fuels[fuelKey].sum / fuels[fuelKey].count;
        }
      });
      
      return dataPoint;
    });

    return result;
  }, [filteredDailyPrices, settings]);

  const fuelNames = useMemo(() => {
    if (!chartData.length) return [];
    const names = new Set();
    chartData.forEach(d => {
      Object.keys(d).forEach(key => {
        if (key !== 'date') names.add(key);
      });
    });
    return Array.from(names);
  }, [chartData]);

  const selectedBaseName = useMemo(() => {
    if (selectedBase === 'all') return 'Todas as Bases';
    return baseCities.find(base => base.id === selectedBase)?.name || 'Base desconhecida';
  }, [selectedBase, baseCities]);

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-6 flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-destructive text-center">{error}</p>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card border rounded-lg p-6"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Droplets className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Médias Gerais por Combustível</h3>
            <p className="text-sm text-muted-foreground">
              Preço médio de todos os fornecedores por tipo de combustível · {selectedBaseName}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={period} onValueChange={setPeriod}>
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
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Linhas</SelectItem>
                <SelectItem value="bar">Barras</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={fetchData} variant="ghost" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
          <Droplets className="w-12 h-12 mb-4" />
          <p className="font-semibold">Nenhum dado disponível</p>
          <p className="text-sm">
            Lance preços de combustível para visualizar o gráfico de médias
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[
                  (dataMin) => Math.floor(dataMin * 0.95),
                  (dataMax) => Math.ceil(dataMax * 1.05)
                ]}
                tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
              {fuelNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS[index % COLORS.length], r: 4 }}
                  activeDot={{ r: 6 }}
                  name={name}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[
                  (dataMin) => Math.floor(dataMin * 0.95),
                  (dataMax) => Math.ceil(dataMax * 1.05)
                ]}
                tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {fuelNames.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={COLORS[index % COLORS.length]}
                  name={name}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      )}

      <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> Este gráfico mostra a média de preços de todos os fornecedores para cada tipo de combustível. 
          Os valores são calculados diariamente com base nos preços lançados no sistema.
        </p>
      </div>
    </motion.div>
  );
};

export default AverageFuelPricesChart;
