import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, MapPin, Building2, DollarSign, Fuel, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const BestCostAnalysis = ({ 
  selectedGroup, 
  selectedFuel, 
  baseCities = [],
  groups = [],
  postos = [],
  dailyPrices = [],
  suppliers = [],
  freightRoutes = [],
  settings = {}
}) => {
  
  const analysis = useMemo(() => {
    if (!selectedGroup || selectedGroup === 'Todos' || !selectedFuel) {
      return null;
    }

    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return null;

    // Postos do grupo selecionado
    const groupPostos = postos.filter(p => 
      (p.group_ids || []).includes(selectedGroup)
    );

    if (groupPostos.length === 0) return null;

    // Para cada base, calcular os custos médios
    const baseAnalysis = baseCities.map(base => {
      const costsPerPosto = groupPostos.map(posto => {
        const postoBandeira = posto.bandeira || 'bandeira_branca';
        
        // Preços da base para fornecedores que têm esse combustível
        const basePrices = dailyPrices.filter(dp => 
          dp.base_city_id === base.id &&
          dp.group_ids?.includes(selectedGroup) &&
          dp.prices?.[selectedFuel]
        );

        if (basePrices.length === 0) return null;

        // Calcular custo por fornecedor (preço + frete)
        const supplierCosts = basePrices.map(priceRecord => {
          const supplier = suppliers.find(s => s.id === priceRecord.supplier_id);
          
          // FILTRO DE BANDEIRA: Verificar compatibilidade
          if (supplier) {
            const supplierBandeira = supplier.bandeira || 'bandeira_branca';
            // Se posto é bandeirado, só aceita fornecedor da mesma bandeira ou bandeira branca
            if (postoBandeira !== 'bandeira_branca') {
              if (supplierBandeira !== postoBandeira && supplierBandeira !== 'bandeira_branca') {
                return null; // Fornecedor incompatível
              }
            }
          }
          
          const basePrice = priceRecord.prices[selectedFuel];

          // Buscar frete da base até o posto (frete é por veículo, não por combustível)
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

        return {
          posto: posto.name,
          city: posto.city?.name,
          costs: supplierCosts.sort((a, b) => a.finalCost - b.finalCost)
        };
      }).filter(Boolean);

      if (costsPerPosto.length === 0 || costsPerPosto.every(c => c.costs.length === 0)) {
        return null;
      }

      // Calcular estatísticas da base
      const allCosts = costsPerPosto.flatMap(p => p.costs);
      const bestCost = Math.min(...allCosts.map(c => c.finalCost));
      const avgCost = allCosts.reduce((sum, c) => sum + c.finalCost, 0) / allCosts.length;
      const bestSupplier = allCosts.find(c => c.finalCost === bestCost);

      return {
        base: base.name,
        baseId: base.id,
        bestCost,
        avgCost,
        bestSupplier: bestSupplier?.supplier,
        bestPosto: bestSupplier?.posto,
        postos: costsPerPosto.length,
        suppliers: [...new Set(allCosts.map(c => c.supplier))].length,
        details: costsPerPosto
      };
    }).filter(Boolean);

    if (baseAnalysis.length === 0) return null;

    // Ordenar por melhor custo
    baseAnalysis.sort((a, b) => a.bestCost - b.bestCost);

    const bestBase = baseAnalysis[0];
    const worstBase = baseAnalysis[baseAnalysis.length - 1];
    const savings = worstBase.bestCost - bestBase.bestCost;
    const savingsPercent = (savings / worstBase.bestCost) * 100;

    return {
      group: group.name,
      bases: baseAnalysis,
      bestBase,
      worstBase,
      savings,
      savingsPercent,
      fuelName: settings.fuelTypes?.[selectedFuel]?.name || selectedFuel
    };
  }, [selectedGroup, selectedFuel, baseCities, groups, postos, dailyPrices, suppliers, freightRoutes, settings]);

  if (!analysis) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Selecione um grupo e combustível para ver a análise de melhores custos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      <div className="grid md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-muted-foreground">Melhor Base</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{analysis.bestBase.base}</p>
          <p className="text-sm text-muted-foreground mt-1">
            R$ {analysis.bestBase.bestCost.toFixed(4)}/L
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-muted-foreground">Economia</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            R$ {analysis.savings.toFixed(4)}/L
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {analysis.savingsPercent.toFixed(1)}% mais barato
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
          className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <p className="text-sm font-medium text-muted-foreground">Grupo</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">{analysis.group}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {analysis.bases.length} base(s) disponíveis
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Fuel className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-medium text-muted-foreground">Combustível</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">{analysis.fuelName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Análise completa
          </p>
        </motion.div>
      </div>

      {/* Tabela Comparativa de Bases */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
        className="bg-card border rounded-lg overflow-hidden"
      >
        <div className="p-4 border-b bg-muted/50">
          <h3 className="text-lg font-semibold">Comparação por Base</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Custos finais (preço base + frete) para cada base de carregamento
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Base</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Melhor Fornecedor</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Melhor Preço</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Preço Médio</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Postos</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Fornecedores</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {analysis.bases.map((base, index) => {
                const diff = base.bestCost - analysis.bestBase.bestCost;
                const diffPercent = (diff / analysis.bestBase.bestCost) * 100;
                const isBest = index === 0;

                return (
                  <tr key={base.baseId} className={isBest ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted/50'}>
                    <td className="px-4 py-3">
                      {isBest ? (
                        <Award className="w-5 h-5 text-green-600" />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-medium">{base.base}</span>
                        {isBest && (
                          <Badge variant="default" className="bg-green-600">Melhor</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {base.bestSupplier}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-600">
                        R$ {base.bestCost.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      R$ {base.avgCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{base.postos}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline">{base.suppliers}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isBest ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="w-4 h-4 text-red-500" />
                          <span className="text-red-600 font-medium">
                            +R$ {diff.toFixed(4)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({diffPercent.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detalhes por Base */}
      <div className="grid md:grid-cols-2 gap-4">
        {analysis.bases.slice(0, 2).map((base, idx) => (
          <motion.div
            key={base.baseId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.5 + idx * 0.1 } }}
            className="bg-card border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {base.base}
              </h4>
              {idx === 0 && (
                <Badge className="bg-green-600">Recomendado</Badge>
              )}
            </div>

            <div className="space-y-3">
              {base.details.slice(0, 3).map((detail, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground">{detail.posto}</span>
                    <span className="text-xs text-muted-foreground">{detail.city}</span>
                  </div>
                  {detail.costs.slice(0, 1).map((cost, j) => (
                    <div key={j} className="flex items-center justify-between pl-4 text-xs">
                      <span className="text-muted-foreground">{cost.supplier}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          R$ {cost.basePrice.toFixed(4)} + R$ {cost.freight.toFixed(4)}
                        </span>
                        <span className="font-semibold text-green-600">
                          = R$ {cost.finalCost.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {base.details.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{base.details.length - 3} posto(s) adicional(is)
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BestCostAnalysis;
