import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, MapPin, Fuel, DollarSign, TrendingUp, Award, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const BestPricesComparison = ({ settings, cities, suppliers, postos, groups, freightRoutes }) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [selectedFuels, setSelectedFuels] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [todayPrices, setTodayPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const fuelTypes = settings?.fuelTypes || {};

  // Buscar preços de hoje
  useEffect(() => {
    const fetchTodayPrices = async () => {
      if (!userId) return;
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { data, error } = await supabase
          .from('daily_prices')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today);
        
        if (error) throw error;
        setTodayPrices(data || []);
      } catch (err) {
        console.error('Erro ao buscar preços:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayPrices();
  }, [userId]);

  // Inicializar com primeiro combustível
  useEffect(() => {
    if (selectedFuels.length === 0 && Object.keys(fuelTypes).length > 0) {
      setSelectedFuels([Object.keys(fuelTypes)[0]]);
    }
  }, [fuelTypes, selectedFuels.length]);

  // Calcular dados de comparação
  const comparisonData = useMemo(() => {
    if (!selectedDestination || selectedFuels.length === 0 || todayPrices.length === 0) {
      return [];
    }

    const results = [];
    const destinationCity = selectedDestination.city;

    // Para cada fornecedor
    suppliers.forEach(supplier => {
      // Para cada base do fornecedor
      (supplier.city_ids || []).forEach(baseCityId => {
        const baseCity = cities.find(c => c.id === baseCityId);
        if (!baseCity) return;

        // Buscar preço deste fornecedor para hoje
        const priceRecord = todayPrices.find(p => p.supplier_id === supplier.id);
        if (!priceRecord || !priceRecord.prices) return;

        // Buscar frete desta base para o destino
        const freightRoute = freightRoutes.find(
          r => r.origin_city_id === baseCityId && r.destination_city_id === destinationCity?.id
        );

        // Para cada combustível selecionado
        selectedFuels.forEach(fuelKey => {
          const fuelPrice = priceRecord.prices[fuelKey];
          if (!fuelPrice) return;

          // Se tem grupo selecionado, filtrar
          if (selectedGroup && selectedGroup !== 'Todos') {
            const groupPostos = postos.filter(p => 
              (p.group_ids || []).includes(selectedGroup) &&
              p.city_id === destinationCity?.id
            );
            if (groupPostos.length === 0) return;
          }

          // Pegar menor custo de frete disponível (frete é por veículo, não por combustível)
          let freightCost = 0;
          if (freightRoute?.costs) {
            const costs = Object.values(freightRoute.costs).filter(c => typeof c === 'number' && c > 0);
            freightCost = costs.length > 0 ? Math.min(...costs) : 0;
          }
          const totalCost = fuelPrice + freightCost;

          results.push({
            supplier: supplier.name,
            baseCity: baseCity.name,
            baseCityId: baseCityId,
            fuel: fuelTypes[fuelKey]?.name || fuelKey,
            fuelKey,
            fuelPrice,
            freightCost,
            totalCost,
            supplierId: supplier.id,
          });
        });
      });
    });

    // Ordenar por menor custo total
    return results.sort((a, b) => a.totalCost - b.totalCost);
  }, [selectedDestination, selectedFuels, selectedGroup, todayPrices, suppliers, cities, freightRoutes, postos, fuelTypes, settings]);

  // Calcular economia potencial
  const economyStats = useMemo(() => {
    if (comparisonData.length === 0) return null;

    const groupedByFuel = {};
    comparisonData.forEach(item => {
      if (!groupedByFuel[item.fuelKey]) {
        groupedByFuel[item.fuelKey] = [];
      }
      groupedByFuel[item.fuelKey].push(item.totalCost);
    });

    const stats = {};
    Object.entries(groupedByFuel).forEach(([fuelKey, costs]) => {
      const min = Math.min(...costs);
      const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
      const potentialSaving = avg - min;
      
      stats[fuelKey] = {
        fuelName: fuelTypes[fuelKey]?.name || fuelKey,
        min,
        avg,
        potentialSaving,
      };
    });

    return stats;
  }, [comparisonData, fuelTypes]);

  // Filtrar postos do grupo selecionado
  const filteredPostos = useMemo(() => {
    if (!selectedGroup || selectedGroup === 'Todos') return postos;
    return postos.filter(p => (p.group_ids || []).includes(selectedGroup));
  }, [postos, selectedGroup]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-3">
            <Fuel className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Selecione os Parâmetros</h3>
          </div>
          <button className="p-2 hover:bg-muted rounded-md transition-colors">
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFilters && (
        <div className="p-6 pt-2 border-t">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Destino */}
          <div>
            <Label className="mb-2">Destino (Posto)</Label>
            <Select value={selectedDestination?.id || ''} onValueChange={id => setSelectedDestination(postos.find(p => p.id === id))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o posto..." />
              </SelectTrigger>
              <SelectContent>
                {filteredPostos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.city?.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grupo */}
          <div>
            <Label className="mb-2">Grupo</Label>
            <Select value={selectedGroup || 'Todos'} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Grupos</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Combustíveis */}
          <div>
            <Label className="mb-2">Combustíveis</Label>
            <div className="border rounded p-3 space-y-2 max-h-[200px] overflow-y-auto bg-background">
              {Object.entries(fuelTypes).map(([key, fuel]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`fuel-comp-${key}`}
                    checked={selectedFuels.includes(key)}
                    onCheckedChange={(checked) => {
                      setSelectedFuels(prev =>
                        checked ? [...prev, key] : prev.filter(k => k !== key)
                      );
                    }}
                  />
                  <label htmlFor={`fuel-comp-${key}`} className="text-sm cursor-pointer">
                    {fuel.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* Estatísticas de Economia */}
      {economyStats && Object.keys(economyStats).length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(economyStats).map(([fuelKey, stats]) => (
            <motion.div
              key={fuelKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-sm">{stats.fuelName}</h4>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Menor: <span className="font-bold text-foreground">R$ {stats.min.toFixed(4)}/L</span></p>
                <p className="text-muted-foreground">Média: R$ {stats.avg.toFixed(4)}/L</p>
                <p className="text-green-600 font-bold">💰 Economia: R$ {stats.potentialSaving.toFixed(4)}/L</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabela de Comparação */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-6 border-b bg-muted/50">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Comparação de Preços + Frete
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Encontre a melhor opção de fornecedor e base de carregamento
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando preços...</div>
          ) : comparisonData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Selecione um destino e combustíveis para ver a comparação</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-semibold">Posição</th>
                  <th className="text-left p-4 font-semibold">Fornecedor</th>
                  <th className="text-left p-4 font-semibold">Base</th>
                  <th className="text-left p-4 font-semibold">Combustível</th>
                  <th className="text-right p-4 font-semibold">Preço Base</th>
                  <th className="text-right p-4 font-semibold">Frete</th>
                  <th className="text-right p-4 font-semibold">Total/L</th>
                  <th className="text-right p-4 font-semibold">Economia</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((item, index) => {
                  const bestOption = index === 0;
                  const sameFuelItems = comparisonData.filter(d => d.fuelKey === item.fuelKey);
                  const worstInFuel = Math.max(...sameFuelItems.map(d => d.totalCost));
                  const savingVsWorst = worstInFuel - item.totalCost;

                  return (
                    <motion.tr
                      key={`${item.supplierId}-${item.baseCityId}-${item.fuelKey}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={`border-t hover:bg-muted/30 transition-colors ${
                        bestOption ? 'bg-green-500/5' : ''
                      }`}
                    >
                      <td className="p-4">
                        {bestOption ? (
                          <Badge className="bg-green-600">
                            🏆 #{index + 1}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">#{index + 1}</span>
                        )}
                      </td>
                      <td className="p-4 font-medium">{item.supplier}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {item.baseCity}
                        </div>
                      </td>
                      <td className="p-4 text-sm">{item.fuel}</td>
                      <td className="p-4 text-right font-mono">R$ {item.fuelPrice.toFixed(4)}</td>
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        +R$ {item.freightCost.toFixed(4)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-bold font-mono ${bestOption ? 'text-green-600 text-lg' : ''}`}>
                          R$ {item.totalCost.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {savingVsWorst > 0 ? (
                          <span className="text-green-600 font-medium text-sm">
                            -R$ {savingVsWorst.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Dica */}
      {comparisonData.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-600 mb-1">💡 Dica de Economia</p>
              <p className="text-muted-foreground">
                A melhor opção atual é carregar <strong>{comparisonData[0]?.fuel}</strong> em{' '}
                <strong>{comparisonData[0]?.baseCity}</strong> via <strong>{comparisonData[0]?.supplier}</strong> por{' '}
                <strong className="text-green-600">R$ {comparisonData[0]?.totalCost.toFixed(4)}/L</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BestPricesComparison;
