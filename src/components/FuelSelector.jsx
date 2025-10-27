
import React from 'react';
import { motion } from 'framer-motion';
import { Droplet, Fuel, Truck, Leaf, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FuelSelector = ({ fuelData, selectedFuel, onSelectFuel }) => {
  const fuelTypes = fuelData?.stations[0]?.fuels 
    ? Object.keys(fuelData.stations[0].fuels)
    : [];

  const FuelIcon = ({ type }) => {
    const isAditivado = type.toLowerCase().includes('aditivado');
    const baseType = type.toLowerCase();
    let BaseIcon;

    if (baseType.includes('etanol')) {
      BaseIcon = Leaf;
    } else if (baseType.includes('gasolina')) {
      BaseIcon = Fuel;
    } else if (baseType.includes('diesel')) {
      BaseIcon = Truck;
    } else {
      BaseIcon = Droplet;
    }

    return (
      <div className="relative w-8 h-8 flex items-center justify-center">
        <BaseIcon className="w-6 h-6 text-primary" />
        {isAditivado && (
          <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-effect rounded-xl p-6 space-y-4 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Droplet className="w-5 h-5 text-primary" />
        </div>
        <Label className="text-lg font-semibold text-foreground">1. Tipo de Combustível</Label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fuelTypes.map((fuel) => (
          <motion.button
            key={fuel}
            whileHover={{ scale: 1.05, boxShadow: "0px 5px 15px hsl(var(--primary) / 0.1)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectFuel(fuel)}
            className={cn(
              'p-3 rounded-lg border-2 text-left transition-all duration-300 flex flex-col items-center justify-center gap-2',
              selectedFuel === fuel
                ? 'border-primary bg-primary/10 glow-effect'
                : 'border-border bg-background hover:border-primary/50'
            )}
          >
            <FuelIcon type={fuel} />
            <div className="text-xs font-medium text-foreground text-center leading-tight">{fuel}</div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default FuelSelector;
