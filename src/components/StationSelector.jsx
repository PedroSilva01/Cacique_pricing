import React from 'react';
import { motion } from 'framer-motion';
import { Building2, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const StationSelector = ({ fuelData, selectedFuel, selectedStations, onSelectStations }) => {
  const handleToggleStation = (stationName) => {
    if (selectedStations.includes(stationName)) {
      onSelectStations(selectedStations.filter(s => s !== stationName));
    } else {
      onSelectStations([...selectedStations, stationName]);
    }
  };

  const handleSelectAll = () => {
    if (selectedStations.length === fuelData.stations.length) {
      onSelectStations([]);
    } else {
      onSelectStations(fuelData.stations.map(s => s.name));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-effect rounded-xl p-6 space-y-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <Label className="text-lg font-semibold text-gray-800">3. Selecionar Bases para Simulação</Label>
        </div>
        
        {fuelData?.stations.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {selectedStations.length === fuelData?.stations.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </motion.button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {fuelData?.stations.length > 0 ? fuelData?.stations.map((station) => {
          const isSelected = selectedStations.includes(station.name);
          const fuelPrice = selectedFuel ? station.fuels[selectedFuel] : null;

          return (
            <motion.div
              key={station.name}
              whileHover={{ scale: 1.02, boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.05)" }}
              onClick={() => handleToggleStation(station.name)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isSelected}
                    id={`checkbox-${station.name}`}
                    onCheckedChange={() => handleToggleStation(station.name)}
                  />
                  <label htmlFor={`checkbox-${station.name}`} className="font-semibold text-gray-800 text-sm cursor-pointer">{station.name}</label>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
              </div>

              {fuelPrice ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Preço/L:</span>
                    <span className="text-gray-800 font-semibold">
                      {fuelPrice.currentPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', minimumFractionDigits: 4})}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variação D-1:</span>
                    <span className={`font-semibold ${
                      fuelPrice.difference > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fuelPrice.difference > 0 ? '▲' : '▼'}{' '}{Math.abs(fuelPrice.difference).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : <div className="text-xs text-gray-400">Selecione um combustível</div>}
            </motion.div>
          );
        }) : (
            <div className="col-span-full text-center py-8 text-gray-500">
                Nenhuma base disponível para a bandeira selecionada. Altere o filtro de bandeira.
            </div>
        )}
      </div>
    </motion.div>
  );
};

export default StationSelector;