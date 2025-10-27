
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-effect rounded-lg p-4 border shadow-md bg-background/80 backdrop-blur-sm">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((item, index) => (
            <p key={index} style={{ color: item.color }} className="text-sm">
                {`${item.name}: ${item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
};

const ChartsSection = ({ results, suppliers, postos, groups, selectedFuel, fuelTypes, selectedBase }) => {
  const chartData = useMemo(() => {
    if (!results || results.length === 0 || !groups.length) return [];

    const dataByGroup = results.reduce((acc, result) => {
        const supplier = suppliers.find(s => s.id === result.id);
        if (!supplier) return acc;
        
        // Find which postos can be supplied by this supplier
        const suppliedPostos = postos.filter(p => p.allowed_supply_cities?.some(city_id => supplier.city_ids?.includes(city_id)));

        suppliedPostos.forEach(posto => {
            (posto.group_ids || []).forEach(groupId => {
                if (!acc[groupId]) {
                    const group = groups.find(g => g.id === groupId);
                    acc[groupId] = { name: group?.name || 'Sem Grupo', count: 0, totalFinalPrice: 0, totalBasePrice: 0, totalFreight: 0 };
                }
                acc[groupId].count++;
                acc[groupId].totalFinalPrice += result.finalPrice;
                acc[groupId].totalBasePrice += result.currentPrice;
                acc[groupId].totalFreight += result.freight;
            });
        });
        
        return acc;
    }, {});

    return Object.values(dataByGroup)
      .map(group => ({
          name: group.name,
          'Preço Final/L': group.totalFinalPrice / group.count,
          'Preço Base/L': group.totalBasePrice / group.count,
          'Frete/L': group.totalFreight / group.count,
      }))
      .sort((a, b) => a['Preço Final/L'] - b['Preço Final/L']);

  }, [results, suppliers, postos, groups]);

  if (!chartData || chartData.length === 0) return null;

  const fuelName = fuelTypes?.[selectedFuel]?.name || selectedFuel || 'Combustível';
  const baseName = selectedBase?.name || 'Todas as Bases';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card border rounded-lg p-6 space-y-4 mt-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Análise Gráfica por Grupo</h3>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <p>Combustível: <span className="font-semibold">{fuelName}</span></p>
              <p>Base: <span className="font-semibold">{baseName}</span></p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-96">
          <h4 className="text-center font-semibold text-muted-foreground mb-4">Composição do Preço Médio por Litro</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                tickFormatter={(value) => `R$ ${value.toFixed(2)}`} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }} />
              <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
              <defs>
                <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} /></linearGradient>
                <linearGradient id="colorFreight" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.8} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.6} /></linearGradient>
              </defs>
              <Bar dataKey="Preço Base/L" stackId="a" fill="url(#colorBase)" barSize={40} />
              <Bar dataKey="Frete/L" stackId="a" fill="url(#colorFreight)" radius={[8, 8, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
    </motion.div>
  );
};

export default ChartsSection;
