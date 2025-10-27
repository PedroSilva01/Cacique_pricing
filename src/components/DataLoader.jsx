import React from 'react';
import { motion } from 'framer-motion';
import { Database, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DataLoader = ({ onDataLoaded, loading, loaded }) => {

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-effect rounded-2xl p-8 text-center space-y-6 shadow-sm"
    >
      <div className="flex justify-center">
        <div className="p-4 bg-blue-100 rounded-full">
          <Database className="w-12 h-12 text-blue-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-gray-800">
          {loaded ? 'Dados Carregados!' : 'Conectar à Planilha'}
        </h3>
        <p className="text-gray-600">
          {loaded 
            ? 'Planilha sincronizada e pronta para análise'
            : 'Carregue os dados mais recentes do Google Sheets para começar'
          }
        </p>
      </div>

      <Button
        onClick={onDataLoaded}
        disabled={loading}
        size="lg"
        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-6 text-lg glow-effect"
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            Carregando...
          </>
        ) : loaded ? (
          <>
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Recarregar Dados
          </>
        ) : (
          <>
            <Database className="w-5 h-5 mr-2" />
            Carregar Planilha
          </>
        )}
      </Button>

      {loaded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500"
        >
          Última atualização: {new Date().toLocaleString('pt-BR')}
        </motion.div>
      )}
    </motion.div>
  );
};

export default DataLoader;