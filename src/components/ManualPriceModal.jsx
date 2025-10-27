
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

const ManualPriceModal = ({ isOpen, onClose, suppliers, onSave, settings, postos = [], groups = [], baseCities = [] }) => {
  const { toast } = useToast();
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedPostos, setSelectedPostos] = useState([]); // Array de IDs
  const [selectedGroups, setSelectedGroups] = useState([]); // Array de IDs
  const [applyToAll, setApplyToAll] = useState(true); // Aplicar a todos por padrão
  const [prices, setPrices] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { user } = useAuth();
  
  const currentSupplier = suppliers.find(s => s.id === selectedSupplier);
  const availableProducts = currentSupplier?.available_products || [];
  
  // Filtrar bases disponíveis baseado no fornecedor selecionado
  const availableBases = selectedSupplier 
    ? baseCities.filter(bc => currentSupplier.city_ids?.includes(bc.id))
    : baseCities;

  useEffect(() => {
    // Reset prices when supplier changes
    setPrices({});
  }, [selectedSupplier]);

  const handlePriceChange = (fuel, value) => {
    setPrices(prev => ({ ...prev, [fuel]: parseFloat(value) || 0 }));
  };

  const handleSave = () => {
    if (!selectedSupplier || !selectedBase || !date || Object.keys(prices).length === 0) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha fornecedor, base, data e pelo menos um preço.',
        variant: 'destructive'
      });
      return;
    }
    
    const dataToSave = {
      user_id: user.id,
      supplier_id: selectedSupplier,
      base_city_id: selectedBase,
      date,
      prices,
      posto_ids: applyToAll ? null : (selectedPostos.length > 0 ? selectedPostos : null),
      group_ids: applyToAll ? null : (selectedGroups.length > 0 ? selectedGroups : null),
    };
    
    onSave(dataToSave);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="bg-card rounded-lg p-0 w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold">Lançar Preços Manualmente</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </header>

        <main className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date-picker">Data</Label>
              <Input
                id="date-picker"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="supplier-select">Fornecedor</Label>
              <Select onValueChange={setSelectedSupplier}>
                <SelectTrigger id="supplier-select">
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seleção de Base */}
          {selectedSupplier && (
            <div>
              <Label htmlFor="base-select">Base de Fornecimento *</Label>
              <Select onValueChange={setSelectedBase} value={selectedBase || ''}>
                <SelectTrigger id="base-select">
                  <SelectValue placeholder="Selecione a base..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBases.map(base => (
                    <SelectItem key={base.id} value={base.id}>{base.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Toggle Aplicar a Todos */}
          <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg border">
            <Checkbox 
              id="apply-to-all" 
              checked={applyToAll} 
              onCheckedChange={setApplyToAll}
            />
            <label htmlFor="apply-to-all" className="text-sm font-medium cursor-pointer">
              Aplicar este preço para <strong>TODOS os postos e grupos</strong>
            </label>
          </div>

          {!applyToAll && (
            <div className="space-y-4 p-4 border rounded-lg bg-background">
              <p className="text-sm text-muted-foreground">
                💡 Selecione postos e/ou grupos específicos. O preço será aplicado apenas aos selecionados.
              </p>
              
              {/* Multi-select Grupos */}
              {groups.length > 0 && (
                <div>
                  <Label className="font-semibold mb-2 block">Grupos (Múltipla Seleção)</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2 bg-card">
                    {groups.map(g => (
                      <div key={g.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`group-${g.id}`}
                          checked={selectedGroups.includes(g.id)}
                          onCheckedChange={(checked) => {
                            setSelectedGroups(prev =>
                              checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                            );
                          }}
                        />
                        <label htmlFor={`group-${g.id}`} className="text-sm cursor-pointer flex-1">
                          {g.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedGroups.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {selectedGroups.length} grupo(s) selecionado(s) - preço aplicado a TODOS os postos desses grupos
                    </p>
                  )}
                </div>
              )}

              {/* Multi-select Postos */}
              {postos.length > 0 && (
                <div>
                  <Label className="font-semibold mb-2 block">Postos Individuais (Múltipla Seleção)</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2 bg-card">
                    {postos.map(p => (
                      <div key={p.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`posto-${p.id}`}
                          checked={selectedPostos.includes(p.id)}
                          onCheckedChange={(checked) => {
                            setSelectedPostos(prev =>
                              checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                            );
                          }}
                        />
                        <label htmlFor={`posto-${p.id}`} className="text-sm cursor-pointer flex-1">
                          {p.name} {p.city?.name && `(${p.city.name})`}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedPostos.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {selectedPostos.length} posto(s) selecionado(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedSupplier && (
            <div>
              <Label className="font-semibold text-foreground mb-2 block">Preços (R$/L)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-md bg-background">
                {availableProducts.length > 0 ? availableProducts.map(fuelKey => {
                  const fuelInfo = settings.fuelTypes[fuelKey];
                  if (!fuelInfo) return null;
                  return (
                    <div key={fuelKey}>
                      <Label htmlFor={`price-${fuelKey}`}>{fuelInfo.name}</Label>
                      <Input
                        id={`price-${fuelKey}`}
                        type="number"
                        step="0.001"
                        placeholder="0.0000"
                        value={prices[fuelKey] || ''}
                        onChange={e => handlePriceChange(fuelKey, e.target.value)}
                      />
                    </div>
                  );
                }) : <p className="text-sm text-muted-foreground col-span-full">Este fornecedor não possui produtos cadastrados.</p>}
              </div>
            </div>
          )}
        </main>
        
        <footer className="p-4 border-t flex justify-end gap-2 bg-background/50">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selectedSupplier || Object.keys(prices).length === 0}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Preços
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  );
};

export default ManualPriceModal;

