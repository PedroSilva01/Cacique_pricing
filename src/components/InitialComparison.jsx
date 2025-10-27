
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplet, FileText, ChevronDown, ChevronUp, MapPin, Flag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const InitialComparison = ({ dailyPrices, settings, postos, freightRoutes }) => {
  const { toast } = useToast();
  const allFuelTypes = Object.keys(settings.fuelTypes || {});
  
  const [selectedFuel, setSelectedFuel] = useState(allFuelTypes[0] || '');
  const [destinationPostoId, setDestinationPostoId] = useState(settings.defaultDestinationPostoId || postos[0]?.id || '');
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [sortConfig, setSortConfig] = useState({ key: 'finalPrice', direction: 'ascending' });
  
  const brands = ['Todas', ...new Set(dailyPrices.map(p => p.supplier.brand).filter(Boolean))];

  const sortedData = React.useMemo(() => {
    if (!dailyPrices || dailyPrices.length === 0 || !destinationPostoId) {
      return [];
    }
    
    let filteredPrices = dailyPrices;
    if (selectedBrand !== 'Todas') {
      filteredPrices = dailyPrices.filter(p => p.supplier.brand === selectedBrand);
    }

    const sortableItems = filteredPrices.map(priceEntry => {
      const supplier = priceEntry.supplier;
      if (!supplier) return null;

      const basePrice = priceEntry.prices[selectedFuel];
      if (basePrice === undefined || basePrice === null) return null;

      const routeInfo = freightRoutes.find(r => r.origin_city_id === supplier.city_id && r.destination_posto_id === destinationPostoId);
      const freightCost = routeInfo?.costs?.carreta ?? 0;
      const finalPrice = basePrice + freightCost;

      return {
        ...priceEntry,
        supplierName: supplier.name,
        brand: supplier.brand,
        basePrice,
        freightCost,
        finalPrice,
      };
    }).filter(Boolean);

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return sortableItems;
  }, [dailyPrices, selectedFuel, destinationPostoId, freightRoutes, sortConfig, selectedBrand]);

  const handleGenerateReportClick = () => {
    toast({
        title: "🚧 Em construção!",
        description: "A geração de relatórios estará disponível em breve.",
    });
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ children, sortKey }) => (
    <TableHead onClick={() => requestSort(sortKey)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">{children} {sortConfig.key === sortKey && (sortConfig.direction === 'ascending' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />)}</div>
    </TableHead>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-card rounded-xl p-6 shadow-sm border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Comparativo de Preços do Dia</h2>
            <p className="text-muted-foreground">Análise de custo para o destino selecionado.</p>
          </div>
          <Button onClick={handleGenerateReportClick} variant="outline" className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Gerar Relatório
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-muted-foreground" /><Select value={selectedFuel} onValueChange={setSelectedFuel}><SelectTrigger><SelectValue placeholder="Selecione o combustível..."/></SelectTrigger><SelectContent>{allFuelTypes.map(f => <SelectItem key={f} value={f}>{settings.fuelTypes[f]?.name || f}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-muted-foreground" /><Select value={selectedBrand} onValueChange={setSelectedBrand}><SelectTrigger><SelectValue placeholder="Selecione a bandeira..."/></SelectTrigger><SelectContent>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-muted-foreground" /><Select value={destinationPostoId} onValueChange={setDestinationPostoId}><SelectTrigger><SelectValue placeholder="Selecione o destino..."/></SelectTrigger><SelectContent>{postos.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
                <SortableHeader sortKey="supplierName">Fornecedor</SortableHeader>
                <SortableHeader sortKey="brand">Bandeira</SortableHeader>
                <SortableHeader sortKey="basePrice">Preço Base (L)</SortableHeader>
                <SortableHeader sortKey="freightCost">Frete (L)</SortableHeader>
                <SortableHeader sortKey="finalPrice">Preço Final (L)</SortableHeader>
            </TableRow></TableHeader>
            <TableBody>
              {sortedData.length > 0 ? sortedData.map((item, index) => (
                <TableRow key={item.id} className={index === 0 ? 'bg-primary/10' : ''}>
                  <TableCell className="font-medium">{item.supplierName}</TableCell>
                  <TableCell>{item.brand ? <Badge variant="secondary">{item.brand}</Badge> : '-'}</TableCell>
                  <TableCell>{item.basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                  <TableCell>{item.freightCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                  <TableCell className="font-bold">{item.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="text-center h-24">Nenhum dado para exibir com os filtros atuais.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  );
};

export default InitialComparison;
