
import React from 'react';
import { motion } from 'framer-motion';
import { X, FileDown, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ReportModal = ({ reportData, onClose, onExport }) => {
  if (!reportData) return null;

  const { stations, fuel, destination, date } = reportData;
  const bestOption = stations[0];
  const worstOption = stations[stations.length - 1];
  const totalSavings = (worstOption.finalPrice - bestOption.finalPrice);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card text-foreground rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Relatório do Dia</h2>
            <p className="text-sm text-muted-foreground">Resumo da análise de custos para {date}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </header>

        <main className="p-6 overflow-y-auto flex-grow">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-background rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">Combustível</p>
                <p className="text-lg font-bold text-primary">{fuel}</p>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">Destino</p>
                <p className="text-lg font-bold text-primary">{destination}</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-sm font-medium text-green-400">Economia Potencial</p>
                <p className="text-lg font-bold text-green-500">
                  {totalSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L
                </p>
              </div>
            </div>

            <div className="p-4 border-2 border-green-500/50 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-bold text-green-400">Melhor Opção de Compra</h3>
              </div>
              <p className="text-base">
                <span className="font-semibold">{bestOption.brand} - {bestOption.name}</span> com preço final de <span className="font-bold">{bestOption.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}/L</span>.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-3">Tabela Comparativa</h3>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead className="text-right">Preço/L</TableHead>
                      <TableHead className="text-right">Frete/L</TableHead>
                      <TableHead className="text-right">Preço Final/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stations.map((item, index) => (
                      <TableRow key={item.name} className={cn(index === 0 ? "bg-green-500/10" : "")}>
                        <TableCell className="font-semibold">{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.brand}</div>
                        </TableCell>
                        <TableCell className="text-right">{item.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                        <TableCell className="text-right">{item.freightCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                        <TableCell className="text-right font-bold text-base text-primary">{item.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </main>

        <footer className="p-6 border-t bg-background/50 flex justify-end">
          <Button size="lg" onClick={onExport}>
            <FileDown className="w-5 h-5 mr-2" />
            Exportar como PDF
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default ReportModal;
