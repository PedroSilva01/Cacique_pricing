import React from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import BestPricesComparison from '@/components/BestPricesComparison';
import { Button } from '@/components/ui/button';
import { useSimulatorData } from '@/hooks/useSimulatorData';
import { showErrorToast } from '@/lib/utils';

const Simulator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const {
    loading,
    settings,
    cities,
    suppliers,
    postos,
    groups,
    freightRoutes,
    refetch: fetchData,
  } = useSimulatorData(userId, {
    onError: (err) => {
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 rounded-2xl shadow-2xl">
              <Calculator className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">Simulador de Preços</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              Compare fornecedores, bases e calcule a melhor opção de compra
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="max-w-7xl mx-auto">
      {/* Best Prices Comparison Component */}
      <BestPricesComparison
        settings={settings}
        cities={cities}
        suppliers={suppliers}
        postos={postos}
        groups={groups}
        freightRoutes={freightRoutes}
      />
      </div>
    </motion.div>
  );
};

export default Simulator;
