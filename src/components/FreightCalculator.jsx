
import React from 'react';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FreightCalculator = ({ settings, selectedVehicle, onVehicleChange }) => {

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-effect rounded-xl p-6 space-y-4 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-full">
          <Truck className="w-5 h-5 text-blue-600" />
        </div>
        <Label className="text-lg font-semibold text-gray-800">2. Tipo de Veículo</Label>
      </div>

      <div className="space-y-3">
        <Select value={selectedVehicle} onValueChange={onVehicleChange}>
          <SelectTrigger className="h-14 text-lg">
            <SelectValue placeholder="Selecione o tipo de veículo..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(settings.vehicleTypes).map(([key, vehicle]) => (
              <SelectItem key={key} value={key} className="text-base">
                {vehicle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 pt-2">
            O tipo de veículo define o custo do frete por litro, que é buscado das suas rotas salvas em 'Configurações'. O volume da carga é preenchido automaticamente, mas pode ser ajustado.
        </p>
      </div>
    </motion.div>
  );
};

export default FreightCalculator;
