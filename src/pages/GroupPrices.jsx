import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, RefreshCw, Building, MapPin, Edit3, Check, X, AlertTriangle, Download, FileImage, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import BrandBadge from '@/components/ui/BrandBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { defaultSettings } from '@/lib/mockData';

const GroupPrices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [postos, setPostos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [baseCities, setBaseCities] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedBase, setSelectedBase] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupData, setGroupData] = useState(null);
  const [priceData, setPriceData] = useState({});
  const [stationPrices, setStationPrices] = useState({}); // Individual station prices
  const [editingMode, setEditingMode] = useState(false);
  const [selectedPostos, setSelectedPostos] = useState([]);
  const [bulkPrice, setBulkPrice] = useState({});
  const [manuallyMarkedIncorrect, setManuallyMarkedIncorrect] = useState(new Set());
  const [targetPrices, setTargetPrices] = useState({}); // Target prices for the group (with base)
  const reportRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, postosRes, suppliersRes, basesRes, settingsRes] = await Promise.all([
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('postos').select('*, cities(*)').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('base_cities').select('*').eq('user_id', userId),
        supabase.from('user_settings').select('settings').eq('user_id', userId).single()
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (postosRes.error) throw postosRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (basesRes.error) throw basesRes.error;
      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

      setGroups(groupsRes.data || []);
      setPostos(postosRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setBaseCities(basesRes.data || []);

      const rawSettings = settingsRes.data?.settings || {};
      const mergedSettings = {
        ...defaultSettings,
        ...rawSettings,
        vehicleTypes: {
          ...(defaultSettings.vehicleTypes || {}),
          ...(rawSettings.vehicleTypes || {}),
        },
        fuelTypes: {
          ...(rawSettings.fuelTypes || {}),
          ...(defaultSettings.fuelTypes || {}),
        },
      };

      setSettings(mergedSettings);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup && selectedBase && selectedDate) {
      loadGroupPrices();
    }
  }, [selectedGroup, selectedBase, selectedDate]);

  const loadGroupPrices = async () => {
    if (!selectedGroup || !selectedDate) return;

    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return;

    const groupPostos = postos.filter(p => (p.group_ids || []).includes(selectedGroup));
    setGroupData({ ...group, postos: groupPostos });
    
    // Load target prices from group
    setTargetPrices(group.target_prices || {});

    // Carregar preços do dia para todos os postos do grupo
    try {
      const [pricesRes, stationPricesRes] = await Promise.all([
        supabase
          .from('daily_prices')
          .select('*')
          .eq('user_id', userId)
          .eq('date', selectedDate)
          .in('group_ids', [selectedGroup]),
        supabase
          .from('station_prices')
          .select('*')
          .eq('user_id', userId)
          .eq('date', selectedDate)
          .in('station_id', groupPostos.map(p => p.id))
      ]);

      if (pricesRes.error) throw pricesRes.error;
      if (stationPricesRes.error) throw stationPricesRes.error;

      const pricesByPosto = {};
      const stationPricesByPosto = {};
      
      // Get group prices (base prices)
      groupPostos.forEach(posto => {
        pricesByPosto[posto.id] = {};
      });

      pricesRes.data?.forEach(price => {
        price.group_ids?.forEach(groupId => {
          if (groupId === selectedGroup) {
            groupPostos.forEach(posto => {
              pricesByPosto[posto.id] = price.prices || {};
            });
          }
        });
      });

      // Get individual station prices
      stationPricesRes.data?.forEach(sp => {
        stationPricesByPosto[sp.station_id] = sp.prices || {};
      });

      setPriceData(pricesByPosto);
      setStationPrices(stationPricesByPosto);
    } catch (err) {
      console.error('Erro ao carregar preços:', err);
    }
  };

  const handlePostoSelect = (postoId) => {
    setSelectedPostos(prev =>
      prev.includes(postoId)
        ? prev.filter(id => id !== postoId)
        : [...prev, postoId]
    );
  };

  const handleBulkPriceChange = (fuel, value) => {
    setBulkPrice(prev => ({ ...prev, [fuel]: parseFloat(value) || 0 }));
  };

  const applyBulkPrices = () => {
    const newPriceData = { ...priceData };
    selectedPostos.forEach(postoId => {
      newPriceData[postoId] = { ...newPriceData[postoId], ...bulkPrice };
    });
    setPriceData(newPriceData);
    setBulkPrice({});
    setSelectedPostos([]);
    toast({
      title: 'Preços aplicados',
      description: 'Preços foram atualizados nos postos selecionados.'
    });
  };

  // Calculate minimum group prices for comparison
  const getMinGroupPrices = () => {
    const minPrices = {};
    Object.keys(settings.fuelTypes || {}).forEach(fuel => {
      const prices = Object.values(priceData).map(p => p[fuel]).filter(p => p !== undefined && p !== null);
      if (prices.length > 0) {
        minPrices[fuel] = Math.min(...prices);
      }
    });
    return minPrices;
  };

  const handleSaveTargetPrices = async () => {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase
        .from('groups')
        .update({ target_prices: targetPrices })
        .eq('id', selectedGroup)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: '✅ Preços alvo salvos!',
        description: 'Os preços de referência foram atualizados.'
      });

      // Update local group data
      setGroupData(prev => ({ ...prev, target_prices: targetPrices }));
    } catch (err) {
      console.error('Erro ao salvar preços alvo:', err);
      showErrorToast(toast, { title: 'Erro ao salvar preços alvo', error: err });
    }
  };

  const handleTargetPriceChange = (fuel, value) => {
    const price = parseFloat(value) || 0;
    // Key format: fuel_baseId or just fuel if no base selected
    const key = selectedBase ? `${fuel}_${selectedBase}` : fuel;
    setTargetPrices(prev => ({
      ...prev,
      [key]: price
    }));
  };

  const getTargetPriceForDisplay = (fuel) => {
    const key = selectedBase ? `${fuel}_${selectedBase}` : fuel;
    return targetPrices[key] || targetPrices[fuel] || '';
  };

  const handleManualMarkIncorrect = (postoId, fuel) => {
    const key = `${postoId}-${fuel}`;
    setManuallyMarkedIncorrect(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isPriceIncorrect = (postoId, fuel, price) => {
    const key = `${postoId}-${fuel}`;
    if (manuallyMarkedIncorrect.has(key)) return true;
    
    const targetPrice = targetPrices[fuel];
    if (!targetPrice) return false;
    
    return price && (price - targetPrice) >= 0.01;
  };

  const exportToPNG = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `precos-grupo-${groupData?.name || 'sem-nome'}-${selectedDate}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast({ title: '✅ Exportado como PNG!' });
    } catch (err) {
      console.error('Erro ao exportar PNG:', err);
      showErrorToast(toast, { title: 'Erro ao exportar', error: err });
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`precos-grupo-${groupData?.name || 'sem-nome'}-${selectedDate}.pdf`);
      
      toast({ title: '✅ Exportado como PDF!' });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      showErrorToast(toast, { title: 'Erro ao exportar', error: err });
    }
  };

  const handleSave = async () => {
    if (!selectedGroup || !selectedDate) return;

    setSaving(true);
    try {
      // Save individual station prices
      const stationPricesToSave = [];
      
      Object.entries(priceData).forEach(([postoId, prices]) => {
        if (Object.keys(prices).length > 0) {
          stationPricesToSave.push({
            user_id: userId,
            station_id: postoId,
            date: selectedDate,
            prices: prices
          });
        }
      });

      if (stationPricesToSave.length > 0) {
        const { error: stationError } = await supabase
          .from('station_prices')
          .upsert(stationPricesToSave, {
            onConflict: 'user_id, station_id, date'
          });

        if (stationError) throw stationError;

        toast({
          title: '✅ Preços salvos com sucesso!',
          description: `${stationPricesToSave.length} posto(s) atualizados.`
        });
      }
    } catch (err) {
      console.error('Erro ao salvar preços:', err);
      showErrorToast(toast, { title: 'Erro ao salvar preços', error: err });
    } finally {
      setSaving(false);
    }
  };

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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <div className="relative p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-2xl shadow-2xl">
              <Building className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent">Preços por Grupo</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              Visualize e edite os preços de todos os postos de um grupo
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
      {/* Filtros */}
      <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building className="w-5 h-5 text-purple-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="group" className="font-semibold text-slate-700 dark:text-slate-300">Grupo</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger id="group" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue placeholder="Selecione o grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {group.name}
                        {group.bandeira && <BrandBadge bandeira={group.bandeira} size="xs" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="base" className="font-semibold text-slate-700 dark:text-slate-300">Base de Carregamento</Label>
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger id="base" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-400 shadow-sm h-12 rounded-2xl">
                  <SelectValue placeholder="Selecione a base..." />
                </SelectTrigger>
                <SelectContent>
                  {baseCities.map(base => (
                    <SelectItem key={base.id} value={base.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {base.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date" className="font-semibold text-slate-700 dark:text-slate-300">Data</Label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Preços */}
      {groupData && (
        <>
          {/* Target Prices Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preços de Referência do Grupo</CardTitle>
                  <CardDescription>
                    Defina os preços que todos os postos devem seguir
                  </CardDescription>
                </div>
                <Button onClick={handleSaveTargetPrices} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Preços Alvo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                {Object.keys(settings.fuelTypes || {}).map(fuel => (
                  <div key={fuel}>
                    <Label htmlFor={`target-${fuel}`}>
                      {settings.fuelTypes[fuel].name}
                    </Label>
                    <Input
                      id={`target-${fuel}`}
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={getTargetPriceForDisplay(fuel)}
                      onChange={e => handleTargetPriceChange(fuel, e.target.value)}
                      className="border-green-500"
                    />
                  </div>
                ))}
              </div>
              <Alert className="mt-4 border-blue-200 bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {selectedBase ? (
                    <>Preços específicos para base <strong>{baseCities.find(b => b.id === selectedBase)?.name}</strong>. Estes serão usados nos pedidos de compra desta base.</>
                  ) : (
                    <>Preços gerais do grupo. Defina uma base para preços específicos por base de carregamento.</>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Stations List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Postos do Grupo</CardTitle>
                  <CardDescription>
                    {groupData.postos.length} posto(s) encontrados
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPNG}
                    disabled={!groupData}
                  >
                    <FileImage className="w-4 h-4 mr-2" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPDF}
                    disabled={!groupData}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingMode(!editingMode)}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {editingMode ? 'Cancelar' : 'Editar'}
                  </Button>
                  {editingMode && (
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingMode && selectedPostos.length > 0 && (
                <Alert className="mb-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Editando {selectedPostos.length} posto(s) selecionados
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.keys(settings.fuelTypes || {}).map(fuel => (
                        <div key={fuel}>
                          <Label className="text-xs">{settings.fuelTypes[fuel].name}</Label>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={bulkPrice[fuel] || ''}
                            onChange={e => handleBulkPriceChange(fuel, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <Button size="sm" onClick={applyBulkPrices}>
                      Aplicar aos selecionados
                    </Button>
                  </div>
                </Alert>
              )}
              <div ref={reportRef} className="bg-white p-4">
                <div className="mb-4 text-center">
                  <h2 className="text-2xl font-bold">Relatório de Preços - {groupData?.name || ''}</h2>
                  <p className="text-sm text-muted-foreground">Data: {new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {editingMode && <TableHead className="w-12"></TableHead>}
                      <TableHead>Posto</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Base</TableHead>
                      {Object.keys(settings.fuelTypes || {}).map(fuel => (
                        <TableHead key={fuel} className="text-right">
                          {settings.fuelTypes[fuel].name}
                        </TableHead>
                      ))}
                      {Object.keys(settings.fuelTypes || {}).map(fuel => (
                        <TableHead key={`diff-${fuel}`} className="text-right">
                          Diferença
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupData.postos.map(posto => {
                      const postoPrices = priceData[posto.id] || {};
                      const isExpensive = Object.keys(settings.fuelTypes || {}).some(fuel => {
                        const price = postoPrices[fuel];
                        const targetPrice = targetPrices[fuel];
                        return price && targetPrice && (price - targetPrice) >= 0.01;
                      });

                      // Find the base that supplies this station (simplified logic)
                      const supplyingBase = baseCities[0]?.name || 'N/D';

                      return (
                        <TableRow key={posto.id} className={isExpensive ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          {editingMode && (
                            <TableCell>
                              <Checkbox
                                checked={selectedPostos.includes(posto.id)}
                                onCheckedChange={() => handlePostoSelect(posto.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {posto.name}
                              {posto.bandeira && <BrandBadge bandeira={posto.bandeira} size="xs" />}
                              {isExpensive && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{posto.cities?.name}</TableCell>
                          <TableCell className="text-sm">{supplyingBase}</TableCell>
                          {Object.keys(settings.fuelTypes || {}).map(fuel => {
                            const price = postoPrices[fuel];
                            const targetPrice = targetPrices[fuel];
                            const isIncorrect = isPriceIncorrect(posto.id, fuel, price);
                            
                            return (
                              <TableCell key={fuel} className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {editingMode ? (
                                    <Input
                                      type="number"
                                      step="0.0001"
                                      placeholder="0.0000"
                                      value={price || ''}
                                      onChange={e => {
                                        const newPrice = parseFloat(e.target.value) || 0;
                                        setPriceData(prev => ({
                                          ...prev,
                                          [posto.id]: {
                                            ...prev[posto.id],
                                            [fuel]: newPrice
                                          }
                                        }));
                                      }}
                                      className={`w-24 ${isIncorrect ? 'border-red-500' : ''}`}
                                    />
                                  ) : (
                                    <span className={isIncorrect ? 'text-red-600 font-semibold' : ''}>
                                      {price?.toFixed(4) || '-'}
                                    </span>
                                  )}
                                  {!editingMode && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleManualMarkIncorrect(posto.id, fuel)}
                                    >
                                      <AlertTriangle className={`w-3 h-3 ${isIncorrect ? 'text-red-500' : 'text-muted-foreground'}`} />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          {Object.keys(settings.fuelTypes || {}).map(fuel => {
                            const price = postoPrices[fuel];
                            const targetPrice = targetPrices[fuel];
                            
                            if (!price || !targetPrice) {
                              return (
                                <TableCell key={`diff-${fuel}`} className="text-right text-muted-foreground">
                                  -
                                </TableCell>
                              );
                            }
                            
                            const diff = price - targetPrice;
                            const isAboveTarget = diff >= 0.01;
                            const isMarked = manuallyMarkedIncorrect.has(`${posto.id}-${fuel}`);
                            
                            return (
                              <TableCell key={`diff-${fuel}`} className="text-right">
                                {isMarked ? (
                                  <span className="text-red-600 font-medium">Marcado</span>
                                ) : isAboveTarget ? (
                                  <span className="text-red-600 font-medium">
                                    +R$ {diff.toFixed(4)}
                                  </span>
                                ) : diff === 0 ? (
                                  <span className="text-green-600">Igual</span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    R$ {diff.toFixed(4)}
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </motion.div>
  );
};

export default GroupPrices;
