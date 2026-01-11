import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Award, Truck } from 'lucide-react';

const ResultsDisplay = ({ results, selectedFuel, fuelTypes = {} }) => {
  if (!results || results.length === 0) return null;

  const bestDeal = results[0];
  const fuelName = fuelTypes[selectedFuel]?.name || selectedFuel;
  const worstDeal = results[results.length - 1];
  const savings = worstDeal.totalCost - bestDeal.totalCost;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pt-8"
    >
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.08)" }}
          className="glass-effect rounded-xl p-6 border-2 border-green-500/50 glow-effect"
        >
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-6 h-6 text-green-600" />
            <span className="text-sm font-semibold text-gray-600">MELHOR OPÇÃO</span>
          </div>
          <div className="text-2xl font-bold text-green-600 mb-1">
            {bestDeal.station}
          </div>
          <div className="text-3xl font-bold text-gray-800">
            R$ {bestDeal.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            R$ {bestDeal.pricePerLiterWithFreight.toFixed(3)}/L (com frete)
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.08)" }}
          className="glass-effect rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <TrendingDown className="w-6 h-6 text-blue-600" />
            <span className="text-sm font-semibold text-gray-600">ECONOMIA POTENCIAL</span>
          </div>
          <div className="text-4xl font-bold gradient-text">
            R$ {savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Comparando a melhor e a pior opção
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.08)" }}
          className="glass-effect rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            <span className="text-sm font-semibold text-gray-600">OPÇÃO MAIS CARA</span>
          </div>
          <div className="text-2xl font-bold text-orange-500 mb-1">
            {worstDeal.station}
          </div>
          <div className="text-3xl font-bold text-gray-800">
            R$ {worstDeal.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-effect rounded-xl overflow-hidden shadow-sm"
      >
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">Comparativo Detalhado - {fuelName}</h3>
          <p className="text-sm text-gray-500">Custo Total = (Preço Base + Frete) x Volume</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">#</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-600">Base</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Preço Base/L</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Frete/L</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Preço Final/L</th>
                <th className="px-6 py-4 text-right font-semibold text-gray-600">Custo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.map((result, index) => (
                <motion.tr
                  key={result.station}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-green-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-green-100 text-green-700' :
                      index === results.length - 1 ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{result.station}</td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    R$ {result.basePricePerLiter.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    R$ {result.freightCost.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-800">
                    R$ {result.pricePerLiterWithFreight.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-lg text-gray-900">
                    R$ {result.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ResultsDisplay;