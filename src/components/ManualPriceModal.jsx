
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, X, Droplets, AlertTriangle, Users, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
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
  
  // Data local (não UTC)
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [date, setDate] = useState(getLocalDate());
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
              <DatePicker
                value={date}
                onChange={setDate}
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
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="apply-to-all" 
                  checked={applyToAll} 
                  onCheckedChange={setApplyToAll}
                  className="w-5 h-5 border-2 border-blue-300"
                />
                <label htmlFor="apply-to-all" className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer flex items-center gap-2">
                  {applyToAll ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Aplicar a <strong>TODOS</strong> os postos e grupos
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      Selecionar postos ou grupos específicos
                    </>
                  )}
                </label>
              </div>
              {!applyToAll && (
                <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ Selecione ao menos um posto ou grupo
                </div>
              )}
            </div>
          </div>

          {!applyToAll && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card de Grupos */}
                {groups.length > 0 && (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-purple-200 dark:border-purple-700 shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 border-b border-purple-200 dark:border-purple-700">
                      <h4 className="text-base font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        Grupos
                        {selectedGroups.length > 0 && (
                          <span className="ml-auto text-sm font-normal text-purple-600 dark:text-purple-400">
                            {selectedGroups.length} selecionado(s)
                          </span>
                        )}
                      </h4>
                    </div>
                    <div className="p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {groups.map(g => (
                          <div key={g.id} className="flex items-center p-3 rounded-xl border-2 border-purple-100 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all">
                            <Checkbox
                              id={`group-${g.id}`}
                              checked={selectedGroups.includes(g.id)}
                              onCheckedChange={(checked) => {
                                setSelectedGroups(prev =>
                                  checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                                );
                              }}
                              className="w-5 h-5 border-purple-300 text-purple-600"
                            />
                            <label htmlFor={`group-${g.id}`} className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer flex-1">
                              {g.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Card de Postos */}
                {postos.length > 0 && (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-blue-200 dark:border-blue-700 shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 border-b border-blue-200 dark:border-blue-700">
                      <h4 className="text-base font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Building className="w-5 h-5 text-blue-600" />
                        Postos
                        {selectedPostos.length > 0 && (
                          <span className="ml-auto text-sm font-normal text-blue-600 dark:text-blue-400">
                            {selectedPostos.length} selecionado(s)
                          </span>
                        )}
                      </h4>
                    </div>
                    <div className="p-4 max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {postos.map(p => (
                          <div key={p.id} className="flex items-center p-3 rounded-xl border-2 border-blue-100 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all">
                            <Checkbox
                              id={`posto-${p.id}`}
                              checked={selectedPostos.includes(p.id)}
                              onCheckedChange={(checked) => {
                                setSelectedPostos(prev =>
                                  checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                );
                              }}
                              className="w-5 h-5 border-blue-300 text-blue-600"
                            />
                            <label htmlFor={`posto-${p.id}`} className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer flex-1">
                              {p.name}
                              {p.city?.name && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                  ({p.city.name})
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedGroups(groups.map(g => g.id));
                    setSelectedPostos(postos.map(p => p.id));
                  }}
                  className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Selecionar Todos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedGroups([]);
                    setSelectedPostos([]);
                  }}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-950/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar Seleção
                </Button>
              </div>
            </div>
          )}

          {selectedSupplier && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-200 dark:border-green-700 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-800/30 dark:to-emerald-800/30 p-4 border-b border-green-200 dark:border-green-700">
                <h4 className="text-base font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-green-600" />
                  Preços por Litro (R$)
                </h4>
              </div>
              <div className="p-6">
                {availableProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableProducts.map(fuelKey => {
                      const fuelInfo = settings.fuelTypes[fuelKey];
                      if (!fuelInfo) return null;
                      return (
                        <div key={fuelKey} className="bg-white dark:bg-slate-800 rounded-xl border-2 border-green-100 dark:border-green-800 p-4 hover:shadow-md transition-all">
                          <Label htmlFor={`price-${fuelKey}`} className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 block">
                            {fuelInfo.name}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 font-bold text-sm">R$</span>
                            <Input
                              id={`price-${fuelKey}`}
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              value={prices[fuelKey] || ''}
                              onChange={e => handlePriceChange(fuelKey, e.target.value)}
                              className="pl-12 h-12 font-mono text-lg font-semibold border-2 border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                      Este fornecedor não possui produtos cadastrados.
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      Verifique as configurações do fornecedor.
                    </p>
                  </div>
                )}
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

