
import React from 'react';
import { motion } from 'framer-motion';
import { Gauge } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const VolumeInput = ({ volume, onVolumeChange, vehicleTypes }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-effect rounded-xl p-6 space-y-4 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-full">
          <Gauge className="w-5 h-5 text-blue-600" />
        </div>
        <Label className="text-lg font-semibold text-gray-800">3. Volume da Carga (Litros)</Label>
      </div>

      <div className="space-y-3">
        <Input
          type="number"
          value={volume}
          onChange={(e) => onVolumeChange(e.target.value)}
          placeholder="Ex: 30000"
          className="bg-white border-gray-300 text-gray-800 text-lg h-14 focus:border-blue-500 focus:ring-blue-500"
        />
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Volume para cálculo da economia</span>
          <span className="text-blue-600 font-semibold">
            {parseFloat(volume || 0).toLocaleString('pt-BR')} L
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {Object.values(vehicleTypes).map((vehicle) => (
            <motion.button
              key={vehicle.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onVolumeChange(String(vehicle.volume))}
              className="px-2 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs text-gray-700 transition-all"
            >
              {vehicle.name}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default VolumeInput;
