import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Save, RefreshCw, Trash2, MapPin, Building, Copy, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { showErrorToast } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BrandBadge from '@/components/ui/BrandBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePriceEntry } from '@/contexts/PriceEntryContext';
import { DatePicker } from '@/components/ui/date-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PriceEntry = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;
  const { formState, updateFormState, resetForm } = usePriceEntry();

  const [saving, setSaving] = useState(false);
  const {
    loading,
    baseCities,
    suppliers,
    groups,
    postos,
    settings,
    refetch: refetchDashboardData,
  } = useDashboardData(userId, {
    onError: (err) => {
      console.error('Erro ao carregar dados:', err);
      showErrorToast(toast, { title: 'Erro ao carregar dados', error: err });
    },
  });

  // Função para pegar data local (não UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Formulário
  const [date, setDate] = useState(formState.date || getLocalDateString());
  const [selectedBase, setSelectedBase] = useState(formState.selectedBase);
  const [selectedSupplier, setSelectedSupplier] = useState(formState.selectedSupplier);
  const [selectedGroups, setSelectedGroups] = useState(formState.selectedGroups || []); // Array de group IDs
  const [prices, setPrices] = useState(formState.prices || {});
  const [groupSearch, setGroupSearch] = useState(formState.groupSearch || '');
  const [loadingLastPrices, setLoadingLastPrices] = useState(false);
  const [copyPreviousDay, setCopyPreviousDay] = useState(false);
  const [copyingPrices, setCopyingPrices] = useState(false);
  const [missingPrices, setMissingPrices] = useState([]);
  const [validationAlert, setValidationAlert] = useState(null); // { show: boolean, incompatiblePostos: [...] }
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [recentPrices, setRecentPrices] = useState([]);
  const [pricesPage, setPricesPage] = useState(1);
  const [totalPricesPages, setTotalPricesPages] = useState(1);
  const [loadingRecentPrices, setLoadingRecentPrices] = useState(true);
  const [recentPricesFilterDate, setRecentPricesFilterDate] = useState(getLocalDateString()); // Filtro de data independente para últimos preços
  const [maintainedPrices, setMaintainedPrices] = useState({}); // { fuel_key: { price: X, date: 'YYYY-MM-DD' } }
  const [loadingLastPrice, setLoadingLastPrice] = useState({});

  // Dados computados
  const currentSupplier = suppliers.find(s => s.id === selectedSupplier);
  const availableProducts = currentSupplier?.available_products || [];

  // Fetch últimos preços adicionados - apenas da data filtrada
  const fetchRecentPrices = useCallback(async (page = 1) => {
    // Só busca se tiver data selecionada no filtro
    if (!recentPricesFilterDate) {
      setRecentPrices([]);
      setTotalPricesPages(0);
      setLoadingRecentPrices(false);
      return;
    }

    setLoadingRecentPrices(true);
    try {
      const itemsPerPage = 25; // Limite de itens processados por página

      // Buscar TODOS os registros da data para processar
      const { data, error } = await supabase
        .from('daily_prices')
        .select(`
          id,
          date,
          prices,
          created_at,
          group_ids,
          suppliers (name),
          base_cities (name),
          user_id
        `)
        .eq('date', recentPricesFilterDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Processar TODOS os dados para exibir cada preço por posto individualmente
      const allProcessedPrices = [];
      data.forEach(record => {
        // Buscar postos afetados pelos group_ids
        const affectedPostosForRecord = postos.filter(p => 
          (record.group_ids || []).some(gid => (p.group_ids || []).includes(gid))
        );

        // Criar uma entrada para cada combinação posto + produto
        affectedPostosForRecord.forEach(posto => {
          Object.entries(record.prices || {}).forEach(([fuelType, price]) => {
            allProcessedPrices.push({
              id: `${record.id}-${posto.id}-${fuelType}`,
              date: record.date,
              fuelType,
              price,
              supplier: record.suppliers?.name || 'N/A',
              baseCity: record.base_cities?.name || 'N/A',
              posto: posto.name,
              createdAt: record.created_at
            });
          });
        });
      });

      // Agora paginar os itens processados
      const totalItems = allProcessedPrices.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedPrices = allProcessedPrices.slice(startIndex, endIndex);

      setRecentPrices(paginatedPrices);
      setTotalPricesPages(totalPages);
      setPricesPage(page);
    } catch (err) {
      console.error('Erro ao buscar preços recentes:', err);
      showErrorToast(toast, { title: 'Erro ao carregar histórico', error: err });
    } finally {
      setLoadingRecentPrices(false);
    }
  }, [recentPricesFilterDate, postos, toast]);

  // Carregar preços recentes ao montar o componente e quando mudar a data de filtro
  useEffect(() => {
    if (groups.length > 0 && recentPricesFilterDate) {
      fetchRecentPrices(1);
    }
  }, [groups.length, recentPricesFilterDate, fetchRecentPrices]);

  // Calcular postos afetados com memoização
  const affectedPostos = useMemo(() => 
    postos.filter(p => selectedGroups.some(gid => (p.group_ids || []).includes(gid))),
    [postos, selectedGroups]
  );

  const filteredGroups = useMemo(() => 
    groups.filter(group => {
      // Filtro por base
      const baseMatch = !selectedBase || !group.base_city_ids || group.base_city_ids.includes(selectedBase);

      // Filtro por fornecedor: apenas grupos que permitem o fornecedor selecionado
      const supplierMatch = !selectedSupplier || 
        !group.allowed_supplier_ids || 
        group.allowed_supplier_ids.length === 0 || 
        group.allowed_supplier_ids.includes(selectedSupplier);
      
      return supplierMatch && baseMatch;
    }),
    [groups, selectedBase, selectedSupplier]
  );
  
  // Salvar estado no context quando mudar
  useEffect(() => {
    updateFormState({
      date,
      selectedBase,
      selectedSupplier,
      selectedGroups,
      prices,
      groupSearch
    });
  }, [date, selectedBase, selectedSupplier, selectedGroups, prices, groupSearch, updateFormState]);

  // Limpar seleção de grupos quando mudar fornecedor ou base
  useEffect(() => {
    setSelectedGroups([]);
  }, [selectedSupplier, selectedBase]);

  // Inicializar primeira base se nenhuma estiver selecionada
  useEffect(() => {
    if (!baseCities || baseCities.length === 0) return;
    if (!selectedBase) {
      const firstBase = baseCities[0].id;
      setSelectedBase(firstBase);
      updateFormState({ selectedBase: firstBase });
    }
  }, [baseCities, selectedBase, updateFormState]);

  // Verificar se data é fim de semana ou feriado
  const isWeekendOrHoliday = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // Calcular dia anterior útil
  const getPreviousBusinessDay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    
    // Se for domingo, volta para sexta (pula sábado)
    if (date.getDay() === 0) {
      date.setDate(date.getDate() - 2);
    }
    // Se for sábado, volta para sexta
    else if (date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Buscar preços do dia anterior para todos os fornecedores/bases
  const fetchPreviousDayPrices = async () => {
    const previousDay = getPreviousBusinessDay(date);
    
    const { data, error } = await supabase
      .from('daily_prices')
      .select('supplier_id, base_city_id, prices, group_ids')
      .eq('user_id', user.id)
      .eq('date', previousDay);
    
    if (error) throw error;
    return data || [];
  };

  // Copiar preços do dia anterior
  const handleCopyPreviousDayPrices = async () => {
    // Validações necessárias
    if (!date) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }
    if (!selectedBase) {
      toast({ title: 'Selecione uma base', variant: 'destructive' });
      return;
    }
    if (selectedGroups.length === 0) {
      toast({ title: 'Selecione ao menos um grupo', variant: 'destructive' });
      return;
    }
    if (!selectedSupplier) {
      toast({ title: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }
    
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    
    // Se for domingo, verificar se sábado tem preços
    if (dayOfWeek === 0) {
      const saturday = new Date(date + 'T00:00:00');
      saturday.setDate(saturday.getDate() - 1); // Domingo -> Sábado
      const saturdayStr = saturday.toISOString().split('T')[0];
      
      const { data: saturdayData, error: saturdayError } = await supabase
        .from('daily_prices')
        .select('supplier_id, base_city_id')
        .eq('user_id', user.id)
        .eq('date', saturdayStr);
      
      if (saturdayError) throw saturdayError;
      
      if (!saturdayData || saturdayData.length === 0) {
        toast({
          title: 'Não é possível copiar preços',
          description: 'Não há preços cadastrados no sábado. Primeiro copie os preços de sábado (que serão pegos de sexta) para depois poder copiar os de domingo.',
          variant: 'destructive'
        });
        return;
      }
    }
    
    setCopyingPrices(true);
    setMissingPrices([]);
    
    try {
      // Buscar preços do dia anterior para o fornecedor, base e grupos selecionados
      const { data: previousDayData, error: prevError } = await supabase
        .from('daily_prices')
        .select('*')
        .eq('user_id', user.id)
        .eq('supplier_id', selectedSupplier)
        .eq('base_city_id', selectedBase)
        .eq('date', (() => {
          const d = new Date(date + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          return d.toISOString().split('T')[0];
        })());

      if (prevError) throw prevError;

      if (!previousDayData || previousDayData.length === 0) {
        toast({
          title: 'Nenhum preço encontrado',
          description: `Não há preços cadastrados para ${suppliers.find(s => s.id === selectedSupplier)?.name} na base ${baseCities.find(b => b.id === selectedBase)?.name} no dia anterior.`,
          variant: 'destructive'
        });
        return;
      }

      // Verificar se todos os produtos que o fornecedor vende têm preço
      const previousPrices = previousDayData[0]?.prices || {};
      const missingProducts = [];
      
      availableProducts.forEach(fuelKey => {
        if (!previousPrices[fuelKey] || previousPrices[fuelKey] === 0) {
          const fuelInfo = settings.fuelTypes[fuelKey];
          missingProducts.push(fuelInfo?.name || fuelKey);
        }
      });

      if (missingProducts.length > 0) {
        toast({
          title: '⚠️ Produtos sem preço no dia anterior',
          description: `Os seguintes produtos não têm preço cadastrado: ${missingProducts.join(', ')}. Cadastre os preços primeiro antes de copiar.`,
          variant: 'destructive'
        });
        return;
      }

      // Copiar os preços
      setPrices(previousPrices);
      
      toast({
        title: '✅ Preços copiados com sucesso!',
        description: `${Object.keys(previousPrices).length} preço(s) copiado(s) do dia anterior.`
      });
      
      // Limpar checkbox após sucesso
      setCopyPreviousDay(false);
    } catch (err) {
      console.error('Erro ao copiar preços:', err);
      showErrorToast(toast, { title: 'Erro ao copiar preços', error: err });
    } finally {
      setCopyingPrices(false);
    }
  };

  const handlePriceChange = (fuel, value) => {
    setPrices(prev => ({ ...prev, [fuel]: parseFloat(value) || 0 }));
    // Se estava mantido e usuario alterou, remover da lista de mantidos
    if (maintainedPrices[fuel]) {
      setMaintainedPrices(prev => {
        const updated = { ...prev };
        delete updated[fuel];
        return updated;
      });
    }
  };

  // Buscar último preço válido de um produto específico
  const fetchLastValidPrice = useCallback(async (fuelKey) => {
    if (!selectedSupplier || !selectedBase || !date) return;
    
    setLoadingLastPrice(prev => ({ ...prev, [fuelKey]: true }));
    
    try {
      // Buscar último preço antes da data atual
      const { data, error } = await supabase
        .from('daily_prices')
        .select('prices, date, maintained_prices')
        .eq('user_id', user.id)
        .eq('supplier_id', selectedSupplier)
        .eq('base_city_id', selectedBase)
        .lt('date', date)
        .order('date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Encontrar o primeiro registro que tem esse combustível com preço válido
      let lastValidPrice = null;
      let originalDate = null;
      
      for (const record of data || []) {
        if (record.prices && record.prices[fuelKey] && record.prices[fuelKey] > 0) {
          lastValidPrice = record.prices[fuelKey];
          // Se esse preço já era mantido, pegar a data original
          originalDate = record.maintained_prices?.[fuelKey] || record.date;
          break;
        }
      }
      
      if (lastValidPrice) {
        // Atualizar o preço
        setPrices(prev => ({ ...prev, [fuelKey]: lastValidPrice }));
        // Marcar como mantido
        setMaintainedPrices(prev => ({
          ...prev,
          [fuelKey]: { price: lastValidPrice, date: originalDate }
        }));
        
        const fuelName = settings.fuelTypes[fuelKey]?.name || fuelKey;
        toast({
          title: '🔄 Preço mantido',
          description: `${fuelName}: R$ ${lastValidPrice.toFixed(4)} (desde ${new Date(originalDate).toLocaleDateString('pt-BR')})`,
        });
      } else {
        const fuelName = settings.fuelTypes[fuelKey]?.name || fuelKey;
        toast({
          title: '⚠️ Nenhum preço anterior',
          description: `Não há preço anterior cadastrado para ${fuelName}.`,
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Erro ao buscar último preço:', err);
      showErrorToast(toast, { title: 'Erro ao buscar preço anterior', error: err });
    } finally {
      setLoadingLastPrice(prev => ({ ...prev, [fuelKey]: false }));
    }
  }, [selectedSupplier, selectedBase, date, user.id, settings.fuelTypes, toast]);

  const handleGroupToggle = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleLoadLastPrices = async () => {
    if (!selectedSupplier) {
      toast({ title: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }

    if (!selectedBase) {
      toast({ title: 'Selecione uma base (cidade de origem)', variant: 'destructive' });
      return;
    }

    setLoadingLastPrices(true);
    try {
      const { data, error } = await supabase
        .from('daily_prices')
        .select('prices, date')
        .eq('user_id', user.id)
        .eq('supplier_id', selectedSupplier)
        .eq('base_city_id', selectedBase)
        .lte('date', date)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.prices) {
        setPrices(data.prices || {});
        toast({
          title: 'Últimos preços carregados',
          description: `Baseados no lançamento de ${new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR')}`,
        });
      } else {
        toast({
          title: 'Nenhum preço anterior encontrado',
          description: 'Não há lançamentos anteriores para este fornecedor/base.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Erro ao carregar últimos preços:', err);
      showErrorToast(toast, { title: 'Erro ao carregar últimos preços', error: err });
    } finally {
      setLoadingLastPrices(false);
    }
  };

  const validateSupplierCompatibility = () => {
    const incompatiblePostos = [];
    
    // Verificar cada posto afetado
    for (const posto of affectedPostos) {
      // Verificar grupo
      const postoGroups = selectedGroups
        .map(gid => groups.find(g => g.id === gid))
        .filter(g => g && (posto.group_ids || []).includes(g.id));
      
      for (const group of postoGroups) {
        // Se o grupo tem restrição de fornecedores
        if (group.allowed_suppliers && group.allowed_suppliers.length > 0) {
          if (!group.allowed_suppliers.includes(selectedSupplier)) {
            incompatiblePostos.push({
              posto: posto.name,
              group: group.name,
              reason: `Grupo "${group.name}" não permite compras do fornecedor selecionado`
            });
            continue;
          }
        }
      }
      
      // Verificar posto individualmente
      if (posto.allowed_suppliers && posto.allowed_suppliers.length > 0) {
        if (!posto.allowed_suppliers.includes(selectedSupplier)) {
          incompatiblePostos.push({
            posto: posto.name,
            group: postoGroups[0]?.name || 'N/A',
            reason: `Posto não permite compras do fornecedor selecionado`
          });
        }
      }
    }
    
    return incompatiblePostos;
  };

  const handleSave = async () => {
    // Se checkbox de copiar estiver marcado, executar cópia primeiro
    if (copyPreviousDay) {
      await handleCopyPreviousDayPrices();
      return;
    }
    
    // Validações básicas
    if (!selectedSupplier) {
      toast({ title: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }

    if (!selectedBase) {
      toast({ title: 'Selecione uma base (cidade de origem)', variant: 'destructive' });
      return;
    }

    if (!date) {
      toast({ title: 'Selecione uma data', variant: 'destructive' });
      return;
    }

    if (selectedGroups.length === 0) {
      toast({ title: 'Selecione ao menos um grupo de postos', variant: 'destructive' });
      return;
    }

    if (Object.keys(prices).length === 0) {
      toast({ title: 'Preencha ao menos um preço', variant: 'destructive' });
      return;
    }

    // Validar compatibilidade de fornecedores
    const incompatible = validateSupplierCompatibility();
    if (incompatible.length > 0) {
      setValidationAlert({
        show: true,
        incompatiblePostos: incompatible
      });
      return;
    }

    // Prosseguir com salvamento
    await performSave();
  };

  const performSave = async () => {
    setSaving(true);

    try {
      // Preparar maintained_prices - só incluir os que estão mantidos
      const maintained = {};
      Object.keys(maintainedPrices).forEach(fuelKey => {
        if (maintainedPrices[fuelKey]) {
          maintained[fuelKey] = maintainedPrices[fuelKey].date;
        }
      });

      const dataToSave = {
        user_id: user.id,
        supplier_id: selectedSupplier,
        base_city_id: selectedBase,
        date,
        prices,
        group_ids: selectedGroups,
        maintained_prices: Object.keys(maintained).length > 0 ? maintained : {},
      };

      const { error } = await supabase
        .from('daily_prices')
        .upsert(dataToSave, { 
          onConflict: 'user_id, date, supplier_id, base_city_id' 
        });

      if (error) throw error;

      toast({
        title: '✅ Preços salvos com sucesso!',
        description: `Aplicado a ${affectedPostos.length} posto(s) de ${selectedGroups.length} grupo(s)`,
      });

      // Limpar formulário após salvar
      setPrices({});
      setSelectedGroups([]);
      // Recarregar histórico de preços
      fetchRecentPrices(pricesPage);
    } catch (err) {
      console.error('Erro ao salvar preços:', err);
      showErrorToast(toast, { title: 'Erro ao salvar preços', error: err });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setPrices({});
    setSelectedGroups([]);
    setDate(getLocalDateString());
    setGroupSearch('');
    resetForm();
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative p-4 bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 rounded-2xl shadow-2xl">
                <DollarSign className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
                Lançamento de Preços
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">
                Configure preços por fornecedor, base e grupos de postos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetchDashboardData}
              className="shadow-md hover:shadow-lg transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20 shadow-md hover:shadow-lg transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Formulário
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Dados Básicos */}
        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="w-5 h-5 text-blue-600" />
                Dados do Lançamento
              </CardTitle>
              <CardDescription className="text-base">Selecione o fornecedor, base de origem e data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-8">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date" className="font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Data</Label>
                  <DatePicker
                    value={date}
                    onChange={setDate}
                    className="mt-1.5"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDate(getLocalDateString())}
                      className="flex-1 border-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20 font-semibold shadow-sm rounded-xl"
                    >
                      📅 Hoje
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const baseDate = date;
                        if (!baseDate) {
                          toast({ title: 'Selecione uma data primeiro', variant: 'destructive' });
                          return;
                        }
                        const d = new Date(baseDate + 'T00:00:00');
                        d.setDate(d.getDate() - 1);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        setDate(`${year}-${month}-${day}`);
                      }}
                      className="flex-1 border-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20 font-semibold shadow-sm rounded-xl"
                    >
                      ⏮️ Ontem
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="base" className="font-semibold text-slate-700 dark:text-slate-300">Base (Cidade de Origem)</Label>
                  <Select value={selectedBase || ''} onValueChange={setSelectedBase}>
                    <SelectTrigger id="base" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm h-12 rounded-2xl">
                      <SelectValue placeholder="Selecione a base..." />
                    </SelectTrigger>
                    <SelectContent className="border-2 shadow-xl">
                      {baseCities.map(c => (
                        <SelectItem key={c.id} value={c.id} className="hover:bg-blue-50 dark:hover:bg-blue-950/20">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="supplier" className="font-semibold text-slate-700 dark:text-slate-300">Fornecedor</Label>
                  <Select value={selectedSupplier || ''} onValueChange={setSelectedSupplier}>
                    <SelectTrigger id="supplier" className="mt-1.5 border-2 border-slate-300 dark:border-slate-600 focus:border-purple-500 dark:focus:border-purple-400 shadow-sm h-12 rounded-2xl">
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent className="border-2 shadow-xl">
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id} className="hover:bg-purple-50 dark:hover:bg-purple-950/20">
                          <span className="font-medium">{s.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preços - Aparece quando fornecedor é selecionado E grupos foram selecionados */}
          {selectedSupplier && selectedGroups.length > 0 && (
            <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      Preços (R$/L)
                    </CardTitle>
                    <CardDescription className="text-base">Preencha os preços dos combustíveis disponíveis</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadLastPrices}
                    disabled={loadingLastPrices || !selectedSupplier || !selectedBase}
                    className="border-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20 font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {loadingLastPrices ? '⏳ Carregando...' : '🔄 Usar últimos preços'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="grid md:grid-cols-2 gap-6">
                  {availableProducts.length > 0 ? availableProducts.map(fuelKey => {
                    const fuelInfo = settings.fuelTypes[fuelKey];
                    if (!fuelInfo) return null;

                    const isMaintained = maintainedPrices[fuelKey];

                    return (
                      <div key={fuelKey} className="group">
                        <Label htmlFor={`price-${fuelKey}`} className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                          <span className="text-green-600 dark:text-green-400">💰</span>
                          {fuelInfo.name}
                          {isMaintained && (
                            <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full border border-orange-300 dark:border-orange-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Mantido desde {new Date(isMaintained.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-base">R$</span>
                            <Input
                              id={`price-${fuelKey}`}
                              type="number"
                              step="0.0001"
                              placeholder="0.0000"
                              value={prices[fuelKey] || ''}
                              onChange={e => handlePriceChange(fuelKey, e.target.value)}
                              className={`pl-14 pr-4 py-3 border-2 ${isMaintained ? 'border-orange-300 dark:border-orange-600 bg-orange-50/50 dark:bg-orange-900/10' : 'border-green-300 dark:border-green-600'} focus:border-green-500 dark:focus:border-green-400 shadow-sm h-14 font-mono text-xl font-semibold group-hover:border-green-400 dark:group-hover:border-green-500 transition-all rounded-2xl`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fetchLastValidPrice(fuelKey)}
                            disabled={loadingLastPrice[fuelKey] || !selectedSupplier || !selectedBase || !date}
                            className="h-14 px-4 border-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20 font-semibold shadow-sm rounded-xl flex items-center gap-2"
                            title="Manter último preço válido (sem estoque/não enviado)"
                          >
                            {loadingLastPrice[fuelKey] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Manter</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-dashed border-green-300 dark:border-green-700">
                      <DollarSign className="w-16 h-16 text-green-500 dark:text-green-600 mb-4" />
                      <p className="text-center text-green-700 dark:text-green-300 font-semibold text-lg">
                        Selecione um fornecedor que possui produtos cadastrados
                      </p>
                    </div>
                  )}
                </div>

                {/* Botão Salvar dentro do card de preços */}
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={() => {
                      // Validações básicas
                      if (!selectedSupplier) {
                        toast({ title: 'Selecione um fornecedor', variant: 'destructive' });
                        return;
                      }
                      if (!selectedBase) {
                        toast({ title: 'Selecione uma base (cidade de origem)', variant: 'destructive' });
                        return;
                      }
                      if (!date) {
                        toast({ title: 'Selecione uma data', variant: 'destructive' });
                        return;
                      }
                      if (selectedGroups.length === 0) {
                        toast({ title: 'Selecione ao menos um grupo de postos', variant: 'destructive' });
                        return;
                      }
                      if (Object.keys(prices).length === 0) {
                        toast({ title: 'Preencha ao menos um preço', variant: 'destructive' });
                        return;
                      }
                      // Validar compatibilidade
                      const incompatible = validateSupplierCompatibility();
                      if (incompatible.length > 0) {
                        setValidationAlert({ show: true, incompatiblePostos: incompatible });
                        return;
                      }
                      // Abrir modal de confirmação
                      setShowConfirmModal(true);
                    }}
                    disabled={saving || copyingPrices || (!copyPreviousDay && (!selectedSupplier || !selectedBase || selectedGroups.length === 0 || Object.keys(prices).length === 0))}
                    className="px-12 py-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-bold rounded-2xl"
                  >
                    {copyingPrices ? (
                      <><RefreshCw className="w-6 h-6 mr-3 animate-spin" />Copiando preços...</>
                    ) : copyPreviousDay ? (
                      <><Copy className="w-6 h-6 mr-3" />Copiar Preços do Dia Anterior</>
                    ) : (
                      <><Save className="w-6 h-6 mr-3" />{saving ? 'Salvando...' : 'Salvar Preços'}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seleção de Grupos */}
          <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building className="w-5 h-5 text-purple-600" />
                Grupos de Postos
              </CardTitle>
              <CardDescription className="text-base">
                Selecione os grupos. O preço será aplicado automaticamente a <strong>TODOS os postos</strong> de cada grupo selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3">
                {groups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                    <Building className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4" />
                    <p className="text-center text-slate-600 dark:text-slate-400 font-semibold text-lg mb-2">
                      Nenhum grupo cadastrado
                    </p>
                    <p className="text-center text-slate-500 dark:text-slate-500 text-sm">
                      Vá em Configurações para criar grupos de postos
                    </p>
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700">
                    <AlertTriangle className="w-16 h-16 text-amber-500 dark:text-amber-600 mb-4" />
                    <p className="text-center text-amber-700 dark:text-amber-300 font-semibold text-lg">
                      Nenhum grupo encontrado com o filtro atual
                    </p>
                  </div>
                ) : (
                  filteredGroups.map(group => {
                    const groupPostos = postos.filter(p => (p.group_ids || []).includes(group.id));
                    const isSelected = selectedGroups.includes(group.id);

                    return (
                      <div
                        key={group.id}
                        className={`p-5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg ${
                          isSelected 
                            ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 border-2 border-purple-400 dark:border-purple-600' 
                            : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleGroupToggle(group.id)}
                            className="mt-1.5"
                          />
                          <label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer min-w-0">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-200 dark:bg-purple-700' : 'bg-purple-100 dark:bg-purple-900/40'}`}>
                                <Building className={`w-5 h-5 ${isSelected ? 'text-purple-700 dark:text-purple-200' : 'text-purple-600 dark:text-purple-400'}`} />
                              </div>
                              <span className="font-bold text-lg">{group.name}</span>
                              <BrandBadge bandeira={group.bandeira} size="xs" />
                              <Badge variant="secondary" className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold">
                                {groupPostos.length} posto(s)
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 pl-1 break-words">
                              {groupPostos.map(p => p.name).join(', ') || 'Nenhum posto neste grupo'}
                            </p>
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preços - Aparece depois de selecionar grupos */}
          {selectedSupplier && selectedGroups.length > 0 && (
            <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      Preços (R$/L)
                    </CardTitle>
                    <CardDescription className="text-base">Preencha os preços dos combustíveis disponíveis</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadLastPrices}
                    disabled={loadingLastPrices || !selectedSupplier || !selectedBase}
                    className="border-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20 font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {loadingLastPrices ? '⏳ Carregando...' : '🔄 Usar últimos preços'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="grid md:grid-cols-2 gap-6">
                  {availableProducts.length > 0 ? availableProducts.map(fuelKey => {
                    const fuelInfo = settings.fuelTypes[fuelKey];
                    if (!fuelInfo) return null;

                    return (
                      <div key={fuelKey} className="group">
                        <Label htmlFor={`price-${fuelKey}`} className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                          <span className="text-green-600 dark:text-green-400">💰</span>
                          {fuelInfo.name}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-base">R$</span>
                          <Input
                            id={`price-${fuelKey}`}
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={prices[fuelKey] || ''}
                            onChange={e => handlePriceChange(fuelKey, e.target.value)}
                            className="pl-14 pr-4 py-3 border-2 border-green-300 dark:border-green-600 focus:border-green-500 dark:focus:border-green-400 shadow-sm h-14 font-mono text-xl font-semibold group-hover:border-green-400 dark:group-hover:border-green-500 transition-all rounded-2xl"
                          />
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-2 flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-dashed border-green-300 dark:border-green-700">
                      <DollarSign className="w-16 h-16 text-green-500 dark:text-green-600 mb-4" />
                      <p className="text-center text-green-700 dark:text-green-300 font-semibold text-lg">
                        Selecione um fornecedor que possui produtos cadastrados
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

      {/* Últimos Preços Adicionados */}
      <div className="max-w-5xl mx-auto mt-12">
        <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Últimos Preços Adicionados
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Histórico dos últimos preços cadastrados no sistema
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 min-w-[280px]">
                <Label htmlFor="filter-date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filtrar por Data</Label>
                <DatePicker
                  value={recentPricesFilterDate}
                  onChange={setRecentPricesFilterDate}
                  className="w-full"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="space-y-3">
              {loadingRecentPrices ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <RefreshCw className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4 animate-spin" />
                  <p className="text-center text-slate-600 dark:text-slate-400 font-semibold text-lg mb-2">
                    Carregando histórico de preços...
                  </p>
                </div>
              ) : recentPrices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <RefreshCw className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4" />
                  <p className="text-center text-slate-600 dark:text-slate-400 font-semibold text-lg mb-2">
                    Nenhum preço encontrado
                  </p>
                  <p className="text-center text-slate-500 dark:text-slate-500 text-sm">
                    Ainda não foram cadastrados preços no sistema
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentPrices.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                              {item.posto}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {item.supplier} • {item.baseCity}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {settings.fuelTypes[item.fuelType]?.name || item.fuelType}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-500">
                            {new Date(item.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-2xl text-green-600 dark:text-green-400 font-mono">
                            R$ {parseFloat(item.price).toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Paginação */}
            {totalPricesPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchRecentPrices(pricesPage - 1)}
                  disabled={pricesPage === 1}
                  className="rounded-xl"
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400 px-4">
                  Página {pricesPage} de {totalPricesPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchRecentPrices(pricesPage + 1)}
                  disabled={pricesPage === totalPricesPages}
                  className="rounded-xl"
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmação */}
      <AlertDialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl">
                <Save className="w-8 h-8 text-white" />
              </div>
              Confirmar Lançamento de Preços
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg mt-4">
              Revise os dados antes de salvar:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-6 space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border-2 border-blue-300 dark:border-blue-700">
              <Label className="text-sm font-bold text-blue-700 dark:text-blue-300">📅 Data</Label>
              <p className="font-bold text-2xl text-blue-900 dark:text-blue-100 mt-1">
                {date ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' }) : '-'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-purple-300 dark:border-purple-700">
                <Label className="text-sm font-bold text-purple-700 dark:text-purple-300">📍 Base</Label>
                <p className="font-bold text-xl text-purple-900 dark:text-purple-100 mt-1">
                  {baseCities.find(c => c.id === selectedBase)?.name || '-'}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl border-2 border-orange-300 dark:border-orange-700">
                <Label className="text-sm font-bold text-orange-700 dark:text-orange-300">🏢 Fornecedor</Label>
                <p className="font-bold text-xl text-orange-900 dark:text-orange-100 mt-1">
                  {suppliers.find(s => s.id === selectedSupplier)?.name || '-'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-400 dark:border-green-600">
              <Label className="text-sm font-bold text-green-700 dark:text-green-300">✅ Postos Afetados</Label>
              <p className="font-bold text-3xl text-green-600 dark:text-green-400 mt-2">
                {affectedPostos.length} posto(s) em {selectedGroups.length} grupo(s)
              </p>
              <div className="mt-4 max-h-[200px] overflow-y-auto space-y-2">
                {affectedPostos.map(posto => (
                  <div key={posto.id} className="flex items-center gap-2 p-2 bg-white/60 dark:bg-slate-800/60 rounded-xl">
                    <Building className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-sm">{posto.name}</span>
                    <span className="text-xs text-muted-foreground">({posto.city?.name})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-2xl border-2 border-yellow-300 dark:border-yellow-700">
              <Label className="text-sm font-bold text-yellow-700 dark:text-yellow-300">💰 Preços</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {Object.entries(prices).map(([fuelKey, price]) => {
                  const fuelInfo = settings.fuelTypes[fuelKey];
                  return (
                    <div key={fuelKey} className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl">
                      <p className="text-xs text-muted-foreground">{fuelInfo?.name}</p>
                      <p className="font-bold text-lg text-yellow-900 dark:text-yellow-100">
                        R$ {parseFloat(price).toFixed(4)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="border-2 rounded-xl px-6 py-3">
              ❌ Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performSave}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-bold"
            >
              ✅ Confirmar e Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Modal de Validação de Fornecedores */}
      <AlertDialog open={validationAlert?.show} onOpenChange={(open) => !open && setValidationAlert(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-2xl text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
              ⚠️ Incompatibilidade de Fornecedores
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base mt-4">
              Os seguintes postos <strong>não podem</strong> comprar do fornecedor selecionado ({currentSupplier?.name}):
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-6 space-y-3">
            {validationAlert?.incompatiblePostos?.map((item, idx) => (
              <div 
                key={idx} 
                className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border-2 border-red-300 dark:border-red-700"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg mt-0.5">
                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg text-red-900 dark:text-red-100">
                      {item.posto}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Grupo: <span className="font-semibold">{item.group}</span>
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2 italic">
                      {item.reason}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <AlertDialogDescription className="text-base bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-300 dark:border-blue-700">
            <strong className="text-blue-900 dark:text-blue-100">💡 Solução:</strong>
            <br />
            Para aplicar preços a esses postos, você precisa:
            <ul className="list-disc list-inside mt-2 space-y-1 text-blue-800 dark:text-blue-200">
              <li>Selecionar um fornecedor compatível com os grupos/postos</li>
              <li>Ou ir em <strong>Configurações</strong> e adicionar este fornecedor como permitido nos grupos/postos</li>
            </ul>
          </AlertDialogDescription>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="border-2">
              Voltar e Ajustar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default PriceEntry;
