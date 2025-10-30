import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { RefreshCw, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-effect rounded-lg p-4 border shadow-md bg-background/95 backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-2">{`Data: ${label}`}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-medium">
            {`${p.name}: $${p.value.toFixed(2)}/barril`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PERIOD_OPTIONS = {
  weekly: { days: 7, label: 'Semanal (7d)' },
  monthly: { days: 30, label: 'Mensal (30d)' },
  bimonthly: { days: 60, label: 'Bimestral (60d)' },
  quarterly: { days: 90, label: 'Trimestral (90d)' },
  semiannual: { days: 180, label: 'Semestral (180d)' },
  annual: { days: 365, label: 'Anual (365d)' },
  biannual: { days: 730, label: 'Bienal (2 anos)' },
  triennial: { days: 1095, label: 'Trienal (3 anos)' },
  fiveYears: { days: 1825, label: '5 anos' },
  tenYears: { days: 3650, label: '10 anos' },
};

const computeMovingAverage = (series, windowSize = 7) => {
  const result = [];
  let sum = 0;
  let count = 0;
  const queue = [];

  series.forEach((value) => {
    if (typeof value === 'number') {
      sum += value;
      queue.push(value);
      count += 1;
    } else {
      queue.push(null);
      count += 1;
    }

    if (queue.length > windowSize) {
      const removed = queue.shift();
      if (typeof removed === 'number') {
        sum -= removed;
        count -= 1;
      }
    }

    if (queue.length === windowSize && count > 0) {
      result.push(sum / count);
    } else {
      result.push(null);
    }
  });

  return result;
};

const OilPriceChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('monthly');
  const [chartType, setChartType] = useState('line');
  const [seriesFilter, setSeriesFilter] = useState('both');
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const forceUpdateOilPrices = async () => {
    setUpdating(true);
    try {
      const forceUpdate = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('fetch-oil-prices');
          if (error) throw error;

          if (data?.data && (data.data.WTI || data.data.BRENT)) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            const { error: upsertError } = await supabase.from('oil_prices').upsert({
              date: today,
              wti_price: data.data.WTI?.price || null,
              brent_price: data.data.BRENT?.price || null,
              wti_change: data.data.WTI?.change || '+0.00%',
              brent_change: data.data.BRENT?.change || '+0.00%',
              timestamp: new Date().toISOString()
            }, {
              onConflict: 'date'
            });

            if (upsertError) throw upsertError;

            setLastUpdate(new Date().toLocaleTimeString());
            await fetchOilPriceHistory();
          } else {
            setError('API não retornou dados');
          }
        } catch (err) {
          console.error('Erro ao forçar atualização:', err);
          setError('Erro ao atualizar preços: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      await forceUpdate();
    } catch (err) {
      console.error('Erro ao forçar atualização:', err);
      setError('Erro ao atualizar preços: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const fetchOilPriceHistory = async (selectedPeriod = period) => {
    setLoading(true);
    setError(null);
    try {
      const periodConfig = PERIOD_OPTIONS[selectedPeriod] || PERIOD_OPTIONS.monthly;
      const daysToFetch = periodConfig.days;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (daysToFetch - 1));
      const fromDate = startDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('oil_prices')
        .select('date, wti_price, brent_price')
        .gte('date', fromDate)
        .order('date', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map(item => {
        const date = new Date(`${item.date}T00:00:00`);
        return {
          isoDate: item.date,
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          WTI: item.wti_price ?? null,
          BRENT: item.brent_price ?? null,
        };
      });

      setChartData(formattedData);
    } catch (err) {
      console.error('Error fetching oil price history:', err);
      setError('Não foi possível carregar o histórico de preços.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOilPriceHistory();
  }, [period]);

  const filteredData = useMemo(() => {
    if (!chartData.length) return [];

    const selectedKeys = [];
    if (seriesFilter === 'both' || seriesFilter === 'wti') selectedKeys.push('WTI');
    if (seriesFilter === 'both' || seriesFilter === 'brent') selectedKeys.push('BRENT');

    const movingAverageCache = {};
    if (showMovingAverage) {
      selectedKeys.forEach((key) => {
        movingAverageCache[key] = computeMovingAverage(chartData.map(entry => entry[key]));
      });
    }

    return chartData.map((entry, index) => {
      const output = {
        date: entry.date,
        isoDate: entry.isoDate,
      };

      selectedKeys.forEach((key) => {
        output[key] = entry[key];
        if (showMovingAverage) {
          output[`${key}_MA`] = movingAverageCache[key]?.[index] ?? null;
        }
      });

      return output;
    });
  }, [chartData, seriesFilter, showMovingAverage]);

  const periodLabel = PERIOD_OPTIONS[period]?.label ?? PERIOD_OPTIONS.monthly.label;
  const hasMovingAverage = showMovingAverage && filteredData.some(entry => Object.keys(entry).some(key => key.endsWith('_MA') && typeof entry[key] === 'number'));

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
        <Button onClick={fetchOilPriceHistory} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center h-96 gap-4">
        <TrendingUp className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center">
          Nenhum dado de histórico disponível ainda.
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Os dados serão coletados automaticamente a cada atualização.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-card border rounded-lg p-6"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Evolução dos Preços do Petróleo</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Preços em USD por barril · {periodLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <Button
            onClick={forceUpdateOilPrices}
            disabled={updating}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'Atualizando...' : 'Atualizar Agora'}
          </Button>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {lastUpdate}
            </span>
          )}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_OPTIONS).map(([key, option]) => (
                <SelectItem key={key} value={key}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo de gráfico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Linhas</SelectItem>
              <SelectItem value="bar">Barras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={seriesFilter} onValueChange={(value) => value && setSeriesFilter(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Séries exibidas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">WTI + Brent</SelectItem>
              <SelectItem value="wti">Somente WTI</SelectItem>
              <SelectItem value="brent">Somente Brent</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 pl-3 border-l pr-3 text-sm text-muted-foreground">
            <Checkbox
              id="toggle-moving-average"
              checked={showMovingAverage}
              onCheckedChange={(checked) => setShowMovingAverage(Boolean(checked))}
            />
            Média móvel (7d)
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        {chartType === 'line' ? (
          <LineChart data={filteredData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            {(seriesFilter === 'both' || seriesFilter === 'wti') && (
              <Line
                type="monotone"
                dataKey="WTI"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name="WTI Crude"
                isAnimationActive={false}
              />
            )}
            {(seriesFilter === 'both' || seriesFilter === 'brent') && (
              <Line
                type="monotone"
                dataKey="BRENT"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
                name="Brent Crude"
                isAnimationActive={false}
              />
            )}
            {hasMovingAverage && (seriesFilter === 'both' || seriesFilter === 'wti') && (
              <Line
                type="monotone"
                dataKey="WTI_MA"
                stroke="#1d4ed8"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
                name="WTI · MM7"
                isAnimationActive={false}
              />
            )}
            {hasMovingAverage && (seriesFilter === 'both' || seriesFilter === 'brent') && (
              <Line
                type="monotone"
                dataKey="BRENT_MA"
                stroke="#047857"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
                name="Brent · MM7"
                isAnimationActive={false}
              />
            )}
          </LineChart>
        ) : (
          <BarChart data={filteredData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="square"
            />
            {(seriesFilter === 'both' || seriesFilter === 'wti') && (
              <Bar dataKey="WTI" fill="#3b82f6" name="WTI Crude" />
            )}
            {(seriesFilter === 'both' || seriesFilter === 'brent') && (
              <Bar dataKey="BRENT" fill="#10b981" name="Brent Crude" />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>

      <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
        <p className="text-xs text-muted-foreground">
          <strong>Nota:</strong> Os preços são atualizados automaticamente pela API em tempo real. 
          WTI (West Texas Intermediate) e Brent são os principais benchmarks globais de petróleo cru.
        </p>
      </div>
    </motion.div>
  );
};

export default OilPriceChart;
