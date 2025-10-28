import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, TrendingDown, Grid3x3, MapPin, Building2, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const ComprehensivePriceMatrix = ({
  selectedGroup,
  groups = [],
  postos = [],
  baseCities = [],
  dailyPrices = [],
  suppliers = [],
  freightRoutes = [],
  settings = {}
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPosto, setSelectedPosto] = useState('all');

  // Filtrar postos do grupo selecionado
  const groupPostos = useMemo(() => {
    if (!selectedGroup || selectedGroup === 'Todos') return [];
    return postos.filter(p => (p.group_ids || []).includes(selectedGroup));
  }, [postos, selectedGroup]);

  // Calcular matriz completa
  const priceMatrix = useMemo(() => {
    if (!selectedGroup || selectedGroup === 'Todos' || !selectedPosto) return null;

    const postosToAnalyze = selectedPosto === 'all' 
      ? groupPostos 
      : groupPostos.filter(p => p.id === selectedPosto);

    if (postosToAnalyze.length === 0) return null;

    const fuelTypes = Object.keys(settings.fuelTypes || {});
    
    // Para cada base, calcular preços de todos os combustíveis
    const baseResults = baseCities.map(base => {
      const fuelPrices = {};
      
      fuelTypes.forEach(fuelKey => {
        // Buscar preços dessa base para esse combustível
        const pricesForFuel = dailyPrices.filter(dp => 
          dp.base_city_id === base.id &&
          dp.group_ids?.includes(selectedGroup) &&
          dp.prices?.[fuelKey]
        );

        if (pricesForFuel.length === 0) {
          fuelPrices[fuelKey] = null;
          return;
        }

        // Calcular custo médio para os postos selecionados
        const costs = postosToAnalyze.map(posto => {
          const postoBandeira = posto.bandeira || 'bandeira_branca';
          
          const supplierCosts = pricesForFuel.map(priceRecord => {
            const supplier = suppliers.find(s => s.id === priceRecord.supplier_id);
            
            // FILTRO DE BANDEIRA: Verificar compatibilidade
            if (supplier) {
              const supplierBandeira = supplier.bandeira || 'bandeira_branca';
              if (postoBandeira !== 'bandeira_branca') {
                if (supplierBandeira !== postoBandeira) {
                  return null; // Fornecedor incompatível
                }
              }
            }
            
            const basePrice = priceRecord.prices[fuelKey];

            // Buscar frete (frete é por veículo, não por combustível)
            const route = freightRoutes.find(r => 
              r.origin_city_id === base.id && 
              r.destination_city_id === posto.city_id
            );
            
            // Pegar menor custo de frete disponível
            let freight = 0;
            if (route?.costs) {
              const costs = Object.values(route.costs).filter(c => typeof c === 'number' && c > 0);
              freight = costs.length > 0 ? Math.min(...costs) : 0;
            }
            
            const finalCost = basePrice + freight;

            return {
              supplier: supplier?.name || 'Desconhecido',
              basePrice,
              freight,
              finalCost,
              posto: posto.name
            };
          }).filter(Boolean); // Remover fornecedores incompatíveis

          // Pegar o melhor custo deste posto
          if (supplierCosts.length === 0) return null;
          const bestCost = supplierCosts.reduce((min, c) => 
            c.finalCost < min.finalCost ? c : min
          );
          return bestCost;
        }).filter(Boolean);

        if (costs.length === 0) {
          fuelPrices[fuelKey] = null;
          return;
        }

        // Média dos custos
        const avgCost = costs.reduce((sum, c) => sum + c.finalCost, 0) / costs.length;
        const bestCost = Math.min(...costs.map(c => c.finalCost));
        const bestSupplier = costs.find(c => c.finalCost === bestCost)?.supplier;

        fuelPrices[fuelKey] = {
          avgCost,
          bestCost,
          bestSupplier,
          details: costs
        };
      });

      return {
        base: base.name,
        baseId: base.id,
        fuelPrices
      };
    });

    // Calcular melhor base para cada combustível
    const bestByFuel = {};
    fuelTypes.forEach(fuelKey => {
      const validBases = baseResults.filter(b => b.fuelPrices[fuelKey]);
      if (validBases.length === 0) return;
      
      const best = validBases.reduce((min, b) => 
        b.fuelPrices[fuelKey].bestCost < (min.fuelPrices[fuelKey]?.bestCost || Infinity) 
          ? b 
          : min
      );
      bestByFuel[fuelKey] = best.base;
    });

    return {
      bases: baseResults,
      fuels: fuelTypes,
      bestByFuel,
      postosCount: postosToAnalyze.length
    };
  }, [selectedGroup, selectedPosto, groupPostos, baseCities, dailyPrices, suppliers, freightRoutes, settings]);

  if (!selectedGroup || selectedGroup === 'Todos') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-lg overflow-hidden"
    >
      {/* Header Colapsável */}
      <div
        className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-b cursor-pointer hover:bg-primary/15 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Grid3x3 className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Matriz Completa de Preços</h3>
              <p className="text-xs text-muted-foreground">
                Compare todos os combustíveis em todas as bases simultaneamente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {priceMatrix && (
              <Badge variant="secondary">
                {priceMatrix.bases.length} bases × {priceMatrix.fuels.length} combustíveis
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Expansível */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-6 space-y-4">
              {/* Seletor de Posto */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Selecione o Posto (ou veja todos)
                  </label>
                  <Select value={selectedPosto} onValueChange={setSelectedPosto}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um posto..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="font-semibold">📊 Todos os Postos do Grupo</span>
                      </SelectItem>
                      {groupPostos.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.city?.name && `(${p.city.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Matriz de Preços */}
              {priceMatrix && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="p-3 text-left font-semibold border-r sticky left-0 bg-muted/50 z-10">
                          Base
                        </th>
                        {priceMatrix.fuels.map(fuelKey => (
                          <th key={fuelKey} className="p-3 text-center font-semibold border-r min-w-[180px]">
                            <div className="flex flex-col items-center">
                              <span>{settings.fuelTypes[fuelKey]?.name}</span>
                              {priceMatrix.bestByFuel[fuelKey] && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  Melhor: {priceMatrix.bestByFuel[fuelKey]}
                                </Badge>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priceMatrix.bases.map((base, idx) => (
                        <tr key={base.baseId} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="p-3 font-medium border-r sticky left-0 bg-inherit z-10">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              {base.base}
                            </div>
                          </td>
                          {priceMatrix.fuels.map(fuelKey => {
                            const fuelData = base.fuelPrices[fuelKey];
                            const isBest = priceMatrix.bestByFuel[fuelKey] === base.base;

                            if (!fuelData) {
                              return (
                                <td key={fuelKey} className="p-3 text-center border-r text-muted-foreground">
                                  -
                                </td>
                              );
                            }

                            // Pegar detalhes do melhor custo
                            const bestDetail = fuelData.details?.find(d => d.finalCost === fuelData.bestCost);

                            return (
                              <td key={fuelKey} className={`p-3 text-center border-r ${isBest ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-2">
                                    {isBest && <Award className="w-4 h-4 text-green-600" />}
                                    <span className={`font-semibold ${isBest ? 'text-green-600' : ''}`}>
                                      R$ {fuelData.bestCost.toFixed(4)}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {fuelData.bestSupplier}
                                  </span>
                                  {bestDetail && (
                                    <span className="text-xs text-muted-foreground">
                                      Base: R$ {bestDetail.basePrice.toFixed(4)} + Frete: R$ {bestDetail.freight.toFixed(4)}
                                    </span>
                                  )}
                                  {selectedPosto === 'all' && (
                                    <span className="text-xs text-muted-foreground">
                                      Média: R$ {fuelData.avgCost.toFixed(4)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legenda */}
              {priceMatrix && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t">
                  <div className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-green-600" />
                    <span>Melhor preço para o combustível</span>
                  </div>
                  {selectedPosto === 'all' && (
                    <div>
                      <span>Analisando {priceMatrix.postosCount} posto(s)</span>
                    </div>
                  )}
                </div>
              )}

              {!priceMatrix && selectedPosto && (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum preço disponível para este grupo/posto</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ComprehensivePriceMatrix;
