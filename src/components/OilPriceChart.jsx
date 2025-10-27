import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { RefreshCw, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const OilPriceChart = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('monthly'); // 'weekly' or 'monthly'
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
            // Data local (não UTC)
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
      // Fetch based on selected period
      const daysToFetch = selectedPeriod === 'weekly' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToFetch);
      const fromDate = startDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('oil_prices')
        .select('date, wti_price, brent_price')
        .gte('date', fromDate)
        .order('date', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map(item => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        WTI: item.wti_price,
        BRENT: item.brent_price,
      }));

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

  if (chartData.length === 0) {
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
              Preços em USD por barril - {period === 'weekly' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal (7d)</SelectItem>
              <SelectItem value="monthly">Mensal (30d)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fetchOilPriceHistory(period)} variant="ghost" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
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
            domain={['dataMin - 2', 'dataMax + 2']}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="WTI"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="WTI Crude"
          />
          <Line
            type="monotone"
            dataKey="BRENT"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
            name="Brent Crude"
          />
        </LineChart>
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
