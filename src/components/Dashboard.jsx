import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw } from 'lucide-react';

import InitialComparison from '@/components/InitialComparison';
import FuelSelector from '@/components/FuelSelector';
import VolumeInput from '@/components/VolumeInput';
import StationSelector from '@/components/StationSelector';
import FreightCalculator from '@/components/FreightCalculator';
import ResultsDisplay from '@/components/ResultsDisplay';
import ChartsSection from '@/components/ChartsSection';
import { useToast } from '@/components/ui/use-toast';

const Dashboard = ({ fuelData, loading, settings, setSettings, onGenerateReport }) => {
  const [selectedFuel, setSelectedFuel] = useState('Diesel S10');
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [volume, setVolume] = useState('50000');
  const [selectedStations, setSelectedStations] = useState([]);
  const [freightCost, setFreightCost] = useState('0.10');
  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [defaultDestination, setDefaultDestination] = useState(settings.defaultDestination);

  const { toast } = useToast();

  useEffect(() => {
    setDefaultDestination(settings.defaultDestination);
  }, [settings.defaultDestination]);

  const handleCalculate = () => {
    if (!selectedFuel) {
      toast({ title: "⚠️ Atenção", description: "Selecione um tipo de combustível", variant: "destructive" });
      return;
    }
    if (!volume || parseFloat(volume) <= 0) {
      toast({ title: "⚠️ Atenção", description: "Informe um volume válido", variant: "destructive" });
      return;
    }
    if (selectedStations.length === 0) {
      toast({ title: "⚠️ Atenção", description: "Selecione pelo menos um grupo de postos", variant: "destructive" });
      return;
    }
    if (parseFloat(freightCost) < 0) {
      toast({ title: "⚠️ Atenção", description: "O custo do frete não pode ser negativo.", variant: "destructive" });
      return;
    }

    setCalculating(true);
    
    setTimeout(() => {
      const volumeNum = parseFloat(volume);
      const freightCostNum = parseFloat(freightCost || '0');
      
      const calculatedResults = selectedStations.map(stationName => {
        const station = fuelData.stations.find(s => s.name === stationName);
        const fuelPrice = station?.fuels[selectedFuel];
        
        if (!fuelPrice) return null;
        
        const pricePerLiterWithFreight = fuelPrice.currentPrice + freightCostNum;
        const totalCost = pricePerLiterWithFreight * volumeNum;

        return {
          station: stationName,
          basePricePerLiter: fuelPrice.currentPrice,
          pricePerLiterWithFreight,
          totalCost,
          difference: fuelPrice.difference,
          volume: volumeNum,
          freightCost: freightCostNum,
        };
      }).filter(Boolean);

      calculatedResults.sort((a, b) => a.totalCost - b.totalCost);

      setResults(calculatedResults);
      setCalculating(false);

      toast({
        title: "🎉 Simulação concluída!",
        description: `${calculatedResults.length} cenários calculados com sucesso.`,
      });
    }, 800);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!fuelData) {
    return <div className="text-center text-gray-600">Não foi possível carregar os dados. Tente recarregar a página.</div>
  }

  const filteredStations = fuelData.stations.filter(station => {
    if (selectedBrand === 'Todas' || selectedBrand === 'Cacique') {
        return true;
    }
    const supplier = settings.suppliers.find(s => s.name === station.name);
    // CORRIGIDO: usar bandeira em vez de brand (propriedade correta do banco)
    return supplier && supplier.bandeira === selectedBrand;
  });

  return (
    <div className="space-y-8">
      <InitialComparison 
        fuelData={{...fuelData, stations: filteredStations}}
        settings={settings} 
        onGenerateReport={onGenerateReport} 
        selectedFuel={selectedFuel}
        onSelectFuel={setSelectedFuel}
        selectedBrand={selectedBrand}
        onSelectBrand={setSelectedBrand}
        defaultDestination={defaultDestination}
        onDestinationChange={setDefaultDestination}
        locations={settings.locations}
      />

      <div className="text-center space-y-3 pt-8">
        <h2 className="text-3xl font-bold text-gray-800">Simulador de Custo de Carga</h2>
        <p className="text-gray-600">Selecione as opções abaixo para simular o custo total de uma carga específica.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <FuelSelector
          fuelData={fuelData}
          selectedFuel={selectedFuel}
          onSelectFuel={setSelectedFuel}
        />
        
        <VolumeInput
          volume={volume}
          onVolumeChange={setVolume}
        />
      </div>

      <StationSelector
        fuelData={{...fuelData, stations: filteredStations}}
        selectedFuel={selectedFuel}
        selectedStations={selectedStations}
        onSelectStations={setSelectedStations}
      />
      
      <FreightCalculator
        freightCost={freightCost}
        onFreightCostChange={setFreightCost}
      />

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex justify-center pt-4"
      >
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg glow-effect transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-lg"
        >
          <Calculator className="w-6 h-6" />
          {calculating ? 'Calculando...' : 'Simular Custo da Carga'}
        </button>
      </motion.div>

      {results && (
        <>
          <ResultsDisplay results={results} selectedFuel={selectedFuel} fuelTypes={settings.fuelTypes} />
          <ChartsSection results={results} />
        </>
      )}
    </div>
  );
};

export default Dashboard;