import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, RefreshCw, Building, MapPin, Edit3, Check, X, AlertTriangle, Download, FileImage, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { priceCacheService } from '@/lib/priceCacheService';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { defaultSettings } from '@/lib/mockData';
import { cacheManager } from '@/lib/cacheManager';
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
import { useMemo } from 'react';

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
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [groupData, setGroupData] = useState(null);
  const [priceData, setPriceData] = useState({});
  const [stationPrices, setStationPrices] = useState({}); // Individual station prices
  const [supplierInfo, setSupplierInfo] = useState({}); // Supplier info by station and fuel
  const [targetPrices, setTargetPrices] = useState({}); // Target prices for the group (with base)
  const [manuallyMarkedIncorrect, setManuallyMarkedIncorrect] = useState(new Set());

  const [selectedPostos, setSelectedPostos] = useState([]);
  const [bulkPrice, setBulkPrice] = useState({});

  const [editMode, setEditMode] = useState(false);
  const [editingPrices, setEditingPrices] = useState({}); // Target prices for the group (with base)
  const reportRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    fetchData();
  }, [userId]);

  // Subscriptions realtime para GroupPrices - preços e configurações críticas
  useEffect(() => {
    if (!userId) return;

    
    // Subscription para daily_prices (crítico - preços mudam constantemente)
    const dailyPricesSubscription = supabase
      .channel('groupprices_daily_prices')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_prices',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // Recarregar preços se grupo e data estão selecionados
        if (selectedGroup && selectedDate) {
          loadGroupPrices();
        }
      })
      .subscribe();

    // Subscription para groups (configurações de grupos podem mudar)
    const groupsSubscription = supabase
      .channel('groupprices_groups')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'groups',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        fetchData(); // Recarrega dados mestres
      })
      .subscribe();

    // Subscription para postos (alterações em postos afetam grupos)
    const postosSubscription = supabase
      .channel('groupprices_postos')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'postos',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        fetchData();
      })
      .subscribe();

    return () => {
      dailyPricesSubscription.unsubscribe();
      groupsSubscription.unsubscribe();
      postosSubscription.unsubscribe();
    };
  }, [userId, selectedGroup, selectedBase, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      
      // Usar cacheManager para carregar configurações básicas
      const configResult = await cacheManager.getUserConfigData(userId);
      
      if (configResult.error) {
        throw configResult.error;
      }
      
      const { data } = configResult;
      
      // Aplicar dados aos states
      setGroups(data.groups || []);
      setPostos(data.postos || []);
      setSuppliers(data.suppliers || []);
      setBaseCities(data.baseCities || []);
      setSettings(data.settings || {});
      
      // Toast informativo sobre cache
      if (data.source === 'cache') {
        toast({
          title: ' Cache Hit!',
          description: 'Dados carregados instantaneamente do Redis',
          duration: 2000
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup && selectedDate) {
      loadGroupPrices();
    }
  }, [selectedGroup, selectedDate, selectedBase]);

  const loadGroupPrices = async () => {
    if (!selectedGroup || !selectedDate) return;

    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return;

    const groupPostos = postos.filter(p => (p.group_ids || []).includes(selectedGroup));
    setGroupData({ ...group, postos: groupPostos });
    
    // Load target prices from group
    setTargetPrices(group.target_prices || {});

    // Carregar preços do dia para todos os postos do grupo usando Redis cache
    try {
      const [pricesRes, stationPricesRes] = await Promise.all([
        // Use cache service for daily prices
        priceCacheService.getDailyPrices({
          date: selectedDate,
          userId,
          groupIds: [selectedGroup],
          baseId: selectedBase,
          supplierId: selectedSupplier,
          useCache: true
        }),
        // Use cache service for station prices
        priceCacheService.getStationPrices(
          selectedDate,
          userId,
          groupPostos.map(p => p.id),
          true // useCache
        )
      ]);

      if (pricesRes.error) throw pricesRes.error;
      if (stationPricesRes.error) throw stationPricesRes.error;

      const pricesByPosto = {};
      const stationPricesByPosto = {};
      
      // CORRIGIDO: Lógica melhorada para Bandeira Branca vs outras bandeiras
      groupPostos.forEach(posto => {
        pricesByPosto[posto.id] = {};
      });

      // Carregar preços do fornecedor selecionado (se houver)
      if (selectedSupplier) {
        // Se um fornecedor específico foi selecionado, usar apenas seus preços
        const selectedSupplierPrices = pricesRes.data?.find(price => 
          price.supplier_id === selectedSupplier && 
          price.group_ids?.includes(selectedGroup)
        );
        
        if (selectedSupplierPrices) {
          groupPostos.forEach(posto => {
            pricesByPosto[posto.id] = selectedSupplierPrices.prices || {};
          });
        }
      } else {
        // Se nenhum fornecedor selecionado, usar preços do grupo
        pricesRes.data?.forEach(price => {
          if (price.group_ids?.includes(selectedGroup)) {
            groupPostos.forEach(posto => {
              // Para Bandeira Branca, usar o primeiro preço encontrado como base
              if (!pricesByPosto[posto.id] || Object.keys(pricesByPosto[posto.id]).length === 0) {
                pricesByPosto[posto.id] = price.prices || {};
              }
            });
          }
        });
      }

      // Get individual station prices (sobrescreve se existir)
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
      const prices = Object.values(priceData)
        .map(p => p[fuel])
        .filter(p => p !== undefined && p !== null && !isNaN(p) && p > 0);
      
      if (prices.length > 0) {
        minPrices[fuel] = Math.min(...prices);
      }
    });
    return minPrices;
  };

  // Calculate price comparisons for suppliers (bandeira branca analysis)
  const priceComparisons = useMemo(() => {
    if (!groupData || groupData.bandeira !== 'bandeira_branca') return {};
    
    const comparisons = {};
    Object.keys(settings.fuelTypes || {}).forEach(fuel => {
      const supplierPrices = [];
      
      // Collect prices from all available suppliers for this fuel
      Object.values(priceData).forEach(prices => {
        if (prices[fuel] && !isNaN(prices[fuel]) && prices[fuel] > 0) {
          supplierPrices.push({
            price: prices[fuel],
            supplier: 'Fornecedor' // We don't have supplier names in priceData
          });
        }
      });
      
      if (supplierPrices.length > 0) {
        // Sort by price
        supplierPrices.sort((a, b) => a.price - b.price);
        
        comparisons[fuel] = {
          cheapest: supplierPrices[0],
          secondCheapest: supplierPrices[1] || null,
          difference: supplierPrices[1] ? supplierPrices[1].price - supplierPrices[0].price : 0,
          totalSuppliers: supplierPrices.length
        };
      }
    });
    
    return comparisons;
  }, [groupData, priceData, settings.fuelTypes]);

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

  const handleSaveEditedPrices = async () => {
    if (!selectedGroup || !selectedDate || Object.keys(editingPrices).length === 0) return;

    setSaving(true);
    try {
      // Salvar preços editados como station_prices para cada posto
      const stationPricesUpdates = [];
      
      Object.entries(editingPrices).forEach(([postoId, prices]) => {
        if (Object.keys(prices).length > 0) {
          stationPricesUpdates.push({
            user_id: userId,
            station_id: postoId,
            date: selectedDate,
            prices: prices
          });
        }
      });

      if (stationPricesUpdates.length > 0) {
        // Use cache service to save station prices (handles both Supabase + Redis)
        const { data, error } = await priceCacheService.saveStationPrices(stationPricesUpdates);
        
        if (error) throw error;
        
        toast({
          title: '✅ Preços salvos!',
          description: `Preços individuais salvos para ${stationPricesUpdates.length} posto(s) com cache Redis.`
        });

        // Recarregar dados para refletir mudanças
        loadGroupPrices();
        setEditMode(false);
        setEditingPrices({});
      }

    } catch (err) {
      console.error('Erro ao salvar preços editados:', err);
      showErrorToast(toast, { title: 'Erro ao salvar preços', error: err });
    } finally {
      setSaving(false);
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
    
    // CORRIGIDO: Buscar target price considerando base selecionada
    const targetPriceKey = selectedBase ? `${fuel}_${selectedBase}` : fuel;
    const targetPrice = targetPrices[targetPriceKey] || targetPrices[fuel];
    if (!targetPrice) return false;
    
    return price && (price - targetPrice) >= 0.02;
  };

  // NOVO: Função para determinar quais combustíveis o grupo realmente vende
  const getAvailableFuelsForGroup = () => {
    if (!groupData || !priceData) return Object.keys(settings.fuelTypes || {});
    
    const availableFuels = new Set();
    
    // Verificar em todos os postos do grupo quais combustíveis têm preços
    groupData.postos?.forEach(posto => {
      const postoPrices = priceData[posto.id] || {};
      Object.entries(postoPrices).forEach(([fuelType, price]) => {
        if (price && price > 0) {
          availableFuels.add(fuelType);
        }
      });
    });

    // Se não encontrou combustíveis específicos, verificar nos dados dos fornecedores (para Bandeira Branca)
    if (availableFuels.size === 0 && supplierInfo && Object.keys(supplierInfo).length > 0) {
      Object.keys(supplierInfo).forEach(fuelType => {
        availableFuels.add(fuelType);
      });
    }

    // Fallback: se ainda não encontrou nada, retornar todos
    if (availableFuels.size === 0) {
      return Object.keys(settings.fuelTypes || {});
    }

    return Array.from(availableFuels);
  };

  const exportToPNG = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 4, 
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: reportRef.current.scrollWidth,
        height: reportRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // Melhorar estilos para impressão/export
          const clonedElement = clonedDoc.querySelector('[data-export-target]') || clonedDoc.body;
          clonedElement.style.padding = '40px';
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          
          // Melhorar qualidade dos textos
          const allTexts = clonedDoc.querySelectorAll('*');
          allTexts.forEach(el => {
            el.style.WebkitFontSmoothing = 'antialiased';
            el.style.MozOsxFontSmoothing = 'grayscale';
          });
        }
      });
      
      // MELHORADO: Nome de arquivo mais informativo
      const dateFormatted = selectedDate ? (() => {
        const [year, month, day] = selectedDate.split('-');
        return `${day}-${month}-${year}`;
      })() : 'data-nao-definida';
      
      const filename = `relatorio-precos-${groupData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'grupo'}-${dateFormatted}.png`;
      
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png', 1.0); // Qualidade máxima
      link.click();
      
      toast({ 
        title: '📸 PNG Exportado!',
        description: `Qualidade: ${canvas.width}x${canvas.height}px`
      });
    } catch (err) {
      console.error('Erro ao exportar PNG:', err);
      toast({ 
        title: '❌ Erro ao exportar PNG', 
        description: 'Tente novamente ou contate o suporte.',
        variant: 'destructive' 
      });
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
                {getAvailableFuelsForGroup().map(fuel => (
                  <div key={fuel}>
                    <Label htmlFor={`target-${fuel}`}>
                      {settings.fuelTypes[fuel]?.name || defaultSettings.fuelTypes?.[fuel]?.name || fuel}
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
                  <CardTitle>Postos do Grupo: {groupData?.name}</CardTitle>
                  <CardDescription className="text-base">
                    <span className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        🏪 {groupData.postos.length} posto(s)
                      </span>
                      <span className="flex items-center gap-1">
                        🏢 {baseCities.find(b => b.id === selectedBase)?.name || 'Todas as Bases'}
                      </span>
                      <span className="flex items-center gap-1">
                        📅 {selectedDate ? (() => {
                          const [year, month, day] = selectedDate.split('-');
                          return `${day}/${month}/${year}`;
                        })() : 'N/A'}
                      </span>
                      {groupData?.bandeira === 'bandeira_branca' && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                          💰 Menores preços
                        </span>
                      )}
                    </span>
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
                    onClick={() => setEditMode(!editMode)}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {editMode ? 'Cancelar' : 'Editar'}
                  </Button>
                  {editMode && (
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editMode && selectedPostos.length > 0 && (
                <Alert className="mb-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Editando {selectedPostos.length} posto(s) selecionados
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.keys(settings.fuelTypes || {}).map(fuel => (
                        <div key={fuel}>
                          <Label className="text-xs">{settings.fuelTypes[fuel]?.name || defaultSettings.fuelTypes?.[fuel]?.name || fuel}</Label>
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
                <div className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Relatório de Preços - {groupData?.name || 'Grupo Selecionado'}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide font-medium">Data</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {selectedDate ? (() => {
                          const [year, month, day] = selectedDate.split('-');
                          return `${day}/${month}/${year}`;
                        })() : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide font-medium">Base</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {baseCities.find(b => b.id === selectedBase)?.name || 'Todas as Bases'}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide font-medium">Postos</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {groupData?.postos.length || 0}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide font-medium">Tipo</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {groupData?.bandeira === 'bandeira_branca' ? 'Bandeira Branca' : 'Bandeira Própria'}
                      </div>
                    </div>
                  </div>
                  {groupData?.bandeira === 'bandeira_branca' && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        Exibindo preços mais competitivos por fornecedor
                      </p>
                    </div>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700">
                      <TableHead className="font-semibold text-left text-slate-700 dark:text-slate-300 py-4">
                        <div className="space-y-1">
                          <div>Combustível</div>
                          {groupData?.bandeira === 'bandeira_branca' && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                              Fornecedor mais competitivo
                            </div>
                          )}
                        </div>
                      </TableHead>
                      {groupData.postos.map(posto => (
                        <TableHead key={posto.id} className="text-center font-semibold text-slate-700 dark:text-slate-300 py-4">
                          <div className="space-y-1">
                            <div>{posto.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                              {posto.cities?.name}
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getAvailableFuelsForGroup().map(fuel => {
                      const fuelComparison = priceComparisons[fuel];
                      
                      return (
                        <TableRow key={fuel} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                          {/* Primeira coluna: Nome do combustível + informação do fornecedor */}
                          <TableCell className="font-medium py-4">
                            <div className="space-y-3">
                              <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                                {settings.fuelTypes[fuel]?.name || defaultSettings.fuelTypes?.[fuel]?.name || fuel}
                              </div>
                              {groupData?.bandeira === 'bandeira_branca' && fuelComparison && (
                                <div className="space-y-2 pl-4 border-l-2 border-slate-300 dark:border-slate-600">
                                  <div className="grid grid-cols-1 gap-1">
                                    <div className="text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">Melhor oferta:</span>
                                      <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">
                                        {fuelComparison.cheapest?.supplier || 'N/D'}
                                      </span>
                                      <span className="ml-2 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                        R$ {fuelComparison.cheapest?.price?.toFixed(4) || '0.0000'}
                                      </span>
                                    </div>
                                    {fuelComparison.secondCheapest && (
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        <span>Segunda opção: {fuelComparison.secondCheapest.supplier}</span>
                                        <span className="ml-2 font-mono">
                                          R$ {fuelComparison.secondCheapest.price.toFixed(4)}
                                        </span>
                                        <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                                          (+R$ {fuelComparison.difference.toFixed(4)})
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-xs text-slate-400 dark:text-slate-500">
                                      {fuelComparison.totalSuppliers} fornecedores avaliados
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Colunas dos postos: preços */}
                          {groupData.postos.map(posto => {
                            const postoPrices = priceData[posto.id] || {};
                            const price = postoPrices[fuel];
                            const targetPrice = targetPrices[fuel];
                            const isIncorrect = targetPrice && price && Math.abs(price - targetPrice) >= 0.02;
                            
                            // Para Bandeira Branca, buscar fornecedor específico deste posto para este combustível
                            let postoSupplier = null;
                            let isBestPrice = false;
                            
                            if (groupData?.bandeira === 'bandeira_branca') {
                              postoSupplier = supplierInfo[posto.id] && supplierInfo[posto.id][fuel] 
                                ? supplierInfo[posto.id][fuel].supplier 
                                : null;
                              
                              // Verificar se é o melhor preço global
                              isBestPrice = fuelComparison?.cheapest && 
                                Math.abs(price - fuelComparison.cheapest.price) < 0.001;
                            }

                            return (
                              <TableCell key={posto.id} className="text-center py-3 px-2 align-top">
                                <div className="flex flex-col items-center space-y-1 min-h-[60px]">
                                  {/* Preço */}
                                  <div className={`font-mono text-sm font-semibold ${
                                    price 
                                      ? (isBestPrice 
                                          ? 'text-emerald-700 dark:text-emerald-400' 
                                          : (isIncorrect 
                                              ? 'text-red-700 dark:text-red-400' 
                                              : 'text-slate-900 dark:text-slate-100'))
                                      : 'text-slate-400'
                                  }`}>
                                    {price ? `R$ ${price.toFixed(4)}` : '—'}
                                  </div>
                                  
                                  {/* Fornecedor específico do posto */}
                                  {groupData?.bandeira === 'bandeira_branca' && postoSupplier && (
                                    <div className="text-xs text-center">
                                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                                        isBestPrice 
                                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                      }`}>
                                        {postoSupplier}
                                      </div>
                                      {isBestPrice && (
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                                          Melhor oferta
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Diferença de preço */}
                                  {groupData?.bandeira === 'bandeira_branca' && price && fuelComparison?.cheapest && !isBestPrice && (
                                    <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                      +R$ {(price - fuelComparison.cheapest.price).toFixed(4)}
                                    </div>
                                  )}
                                </div>
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
