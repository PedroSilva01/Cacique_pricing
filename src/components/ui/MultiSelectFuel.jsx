import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const MultiSelectFuel = ({ selectedFuels, setSelectedFuels, availableFuels, fuelTypes }) => {
  const toggleFuel = (fuelKey) => {
    if (selectedFuels.includes(fuelKey)) {
      setSelectedFuels(selectedFuels.filter(f => f !== fuelKey));
    } else {
      setSelectedFuels([...selectedFuels, fuelKey]);
    }
  };

  const allFuelKeys = Object.keys(fuelTypes);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-muted-foreground">
        Selecione os Combustíveis
      </Label>
      <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg bg-background/50">
        {allFuelKeys.map(fuelKey => {
          const isAvailable = availableFuels.includes(fuelKey);
          const isSelected = selectedFuels.includes(fuelKey);
          const hasRestriction = availableFuels.length > 0 && availableFuels.length < allFuelKeys.length;

          return (
            <motion.div
              key={fuelKey}
              whileHover={{ scale: hasRestriction && !isAvailable ? 1 : 1.02 }}
              className={`flex items-center space-x-2 p-2 rounded-md transition-colors ${
                hasRestriction && !isAvailable 
                  ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                  : 'hover:bg-muted/50 cursor-pointer'
              }`}
            >
              <Checkbox
                id={`fuel-${fuelKey}`}
                checked={isSelected}
                onCheckedChange={() => !hasRestriction || isAvailable ? toggleFuel(fuelKey) : null}
                disabled={hasRestriction && !isAvailable}
                className={isSelected ? 'border-primary' : ''}
              />
              <label
                htmlFor={`fuel-${fuelKey}`}
                className={`text-sm font-medium cursor-pointer flex-1 ${
                  hasRestriction && !isAvailable ? 'line-through' : ''
                }`}
              >
                {fuelTypes[fuelKey].name}
                {hasRestriction && isAvailable && (
                  <span className="ml-1 text-xs text-green-600">✓</span>
                )}
                {hasRestriction && !isAvailable && (
                  <span className="ml-1 text-xs text-muted-foreground">(Indisponível)</span>
                )}
              </label>
            </motion.div>
          );
        })}
      </div>
      {selectedFuels.length > 0 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-muted-foreground"
        >
          {selectedFuels.length} combustível(is) selecionado(s)
        </motion.p>
      )}
    </div>
  );
};

export default MultiSelectFuel;
