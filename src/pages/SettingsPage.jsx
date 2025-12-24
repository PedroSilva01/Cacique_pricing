import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, PlusCircle, Trash2, Edit, Briefcase, Truck, MapPin, Building, Droplets, Car, Users, Lock, CheckCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { defaultSettings } from '@/lib/mockData';
import { showErrorToast } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const SetupGuide = ({ cities, groups, suppliers, postos }) => {
  const steps = [
    { name: 'Cidades', completed: cities.length > 0, description: 'Cadastre as cidades que servem como bases de fornecedores ou localização de postos.' },
    { name: 'Grupos', completed: groups.length > 0, description: 'Crie grupos para organizar seus postos (ex: Rede Principal, Postos Urbanos).' },
    { name: 'Fornecedores', completed: suppliers.length > 0, description: 'Adicione seus fornecedores e as cidades (bases) onde operam.', dependsOn: cities.length > 0 },
    { name: 'Postos', completed: postos.length > 0, description: 'Cadastre seus postos, associando-os a uma cidade e a grupos.', dependsOn: cities.length > 0 },
    { name: 'Rotas de Frete', completed: false, description: 'Defina os custos de frete entre as cidades de origem e destino.', dependsOn: cities.length > 0 },
  ];

  return (
    <div className="bg-card p-6 rounded-xl border shadow-sm mb-8">
      <h2 className="text-xl font-bold text-foreground mb-4">Guia Rápido de Configuração</h2>
      <div className="flex flex-col md:flex-row gap-4">
        {steps.map((step, index) => (
          <div key={index} className="flex-1 flex items-start gap-3 p-3 bg-background rounded-lg">
            {step.completed ? <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" /> : <div className="w-5 h-5 rounded-full border-2 border-primary mt-1 flex-shrink-0" />}
            <div>
              <p className="font-semibold text-foreground">{index + 1}. {step.name}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;

  const [baseCities, setBaseCities] = useState([]);
  const [cities, setCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [freightRoutes, setFreightRoutes] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [modal, setModal] = useState({ type: null, data: null });
  const [newEntityName, setNewEntityName] = useState({ city: '', group: '' });
  const [newBaseCityName, setNewBaseCityName] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [selectedBaseFilter, setSelectedBaseFilter] = useState('all');

  const [supplierSearchInput, setSupplierSearchInput] = useState('');
  const [postoSearchInput, setPostoSearchInput] = useState('');
  const [routeSearchInput, setRouteSearchInput] = useState('');

  const [supplierSearch, setSupplierSearch] = useState('');
  const [postoSearch, setPostoSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');

  const [sortSuppliersBy, setSortSuppliersBy] = useState('updated');
  const [sortPostosBy, setSortPostosBy] = useState('id');
  const [sortRoutesBy, setSortRoutesBy] = useState('updated');
  
  // Estado para modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'danger'
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [baseCitiesRes, citiesRes, suppliersRes, postosRes, routesRes, settingsRes, groupsRes] = await Promise.all([
        supabase.from('base_cities').select('*').eq('user_id', userId).order('name'),
        supabase.from('cities').select('*').eq('user_id', userId).order('name'),
        supabase.from('suppliers').select('*').eq('user_id', userId).order('name'),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', userId).order('name'),
        supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', userId),
        supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
        supabase.from('groups').select('*').eq('user_id', userId).order('name'),
      ]);

      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (postosRes.error) throw postosRes.error;
      if (routesRes.error) throw routesRes.error;
      if (groupsRes.error && groupsRes.error.code !== 'PGRST116') throw groupsRes.error;

      setBaseCities((baseCitiesRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      setCities((citiesRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      setSuppliers((suppliersRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      setPostos((postosRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      setFreightRoutes((routesRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      setGroups((groupsRes.data || []).sort((a, b) => {
        const aNum = parseInt(a.id?.split('-').pop() || a.id || '0');
        const bNum = parseInt(b.id?.split('-').pop() || b.id || '0');
        return aNum - bNum;
      }));
      if (settingsRes.data?.settings) {
        setSettings(settingsRes.data.settings);
      }
    } catch (error) {
      showErrorToast(toast, {
        title: 'Erro ao carregar dados',
        error,
        descriptionPrefix: 'Falha ao buscar as configurações',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { fetchData() }, [fetchData]);

  const handleSave = async (tableName, data) => {
    try {
      const { id, ...dataToSave } = data;
      delete dataToSave.cities; 
      delete dataToSave.city;
      delete dataToSave.origin;
      delete dataToSave.destination;
      
      const record = { ...dataToSave, user_id: user.id };
      if (id) record.id = id;
      
      const { error, data: savedRecord } = await supabase.from(tableName).upsert(record).select().single();
      if (error) throw error;
      
      // SINCRONIZAÇÃO DE BANDEIRAS
      // Se salvou um GRUPO, sincronizar bandeira para todos os postos do grupo
      if (tableName === 'groups' && savedRecord) {
        const groupBandeira = savedRecord.bandeira || 'bandeira_branca';
        const postoIds = savedRecord.posto_ids || [];
        
        if (postoIds.length > 0 && groupBandeira !== 'bandeira_branca') {
          // Atualizar bandeira de todos os postos do grupo
          const { error: updateError } = await supabase
            .from('postos')
            .update({ bandeira: groupBandeira })
            .in('id', postoIds)
            .eq('user_id', user.id);
          
          if (updateError) console.error('Erro ao sincronizar bandeiras dos postos:', updateError);
        }
      }
      
      // Se salvou um POSTO, sincronizar bandeira do primeiro grupo (se houver)
      if (tableName === 'postos' && savedRecord) {
        const groupIds = savedRecord.group_ids || [];
        
        if (groupIds.length > 0) {
          // Buscar o primeiro grupo para pegar sua bandeira
          const { data: firstGroup, error: groupError } = await supabase
            .from('groups')
            .select('bandeira')
            .eq('id', groupIds[0])
            .eq('user_id', user.id)
            .single();
          
          if (!groupError && firstGroup && firstGroup.bandeira && firstGroup.bandeira !== 'bandeira_branca') {
            // Atualizar bandeira do posto com a bandeira do grupo
            const { error: updateError } = await supabase
              .from('postos')
              .update({ bandeira: firstGroup.bandeira })
              .eq('id', savedRecord.id)
              .eq('user_id', user.id);
            
            if (updateError) console.error('Erro ao sincronizar bandeira do posto:', updateError);
          }
        }
      }
      
      await fetchData();
      toast({ title: 'Sucesso!', description: 'Item salvo com sucesso.' });
      setModal({ type: null, data: null });
    } catch (error) {
      showErrorToast(toast, { title: 'Erro ao salvar', error });
    }
  };

  const handleDelete = (tableName, id, itemName = 'este item') => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir ${itemName}? Esta ação não pode ser desfeita.`,
      variant: 'delete',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from(tableName).delete().eq('id', id);
          if (error) throw error;
          
          await fetchData();
          toast({ title: 'Excluído!', description: 'Item excluído com sucesso.' });
        } catch (error) {
          showErrorToast(toast, { title: 'Erro ao excluir', error });
        }
      }
    });
  };
  
  const handleSaveSettings = async () => {
      try {
        const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, settings: settings }, { onConflict: 'user_id' });
        if (error) throw error;
        toast({ title: 'Configurações Gerais Salvas!', description: 'Seus tipos de veículos e combustíveis foram atualizados.' });
      } catch (error) {
        showErrorToast(toast, { title: 'Erro ao salvar configurações', error });
      }
  };

  const handleAddNewInline = async (type, isBase, inputValue, setInputValue) => {
      const name = (inputValue || newEntityName[type] || '').trim();
      if (!name) return;
      
      // Verificar se já existe
      if (type === 'base_city') {
        const exists = baseCities.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) {
          toast({ 
            title: 'Cidade base já existe', 
            description: `A cidade base "${name}" já está cadastrada.`, 
            variant: 'destructive' 
          });
          return;
        }
      } else if (type === 'city') {
        const exists = cities.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) {
          toast({ 
            title: 'Cidade já existe', 
            description: `A cidade "${name}" já está cadastrada.`, 
            variant: 'destructive' 
          });
          return;
        }
      } else if (type === 'group') {
        const exists = groups.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (exists) {
          toast({ 
            title: 'Grupo já existe', 
            description: `O grupo "${name}" já está cadastrado.`, 
            variant: 'destructive' 
          });
          return;
        }
      }
      
      const tableName = type === 'base_city' ? 'base_cities' : (type === 'city' ? 'cities' : 'groups');
      const dataToSave = { name };
      await handleSave(tableName, dataToSave);
      if (setInputValue) {
        setInputValue('');
      } else {
        setNewEntityName(prev => ({...prev, [type]: ''}));
      }
  };

  const renderCard = (title, icon, items, renderItem, onAdd, disabled = false, disabledTooltip = '') => {
    let headerExtras = null;

    if (title === 'Fornecedores') {
      headerExtras = (
        <div className="space-y-1 w-full">
          <Label className="text-[11px] text-muted-foreground">Filtrar fornecedores</Label>
          <Input
            value={supplierSearchInput}
            onChange={(e) => setSupplierSearchInput(e.target.value)}
            placeholder="Buscar por nome, base ou bandeira"
          />
        </div>
      );
    } else if (title === 'Meus Postos') {
      headerExtras = (
        <div className="space-y-1 w-full">
          <Label className="text-[11px] text-muted-foreground">Filtrar postos</Label>
          <Input
            value={postoSearchInput}
            onChange={(e) => setPostoSearchInput(e.target.value)}
            placeholder="Buscar por nome ou cidade"
          />
        </div>
      );
    } else if (title === 'Rotas de Frete') {
      headerExtras = (
        <div className="space-y-1 w-full">
          <Label className="text-[11px] text-muted-foreground">Filtrar rotas de frete</Label>
          <Input
            value={routeSearchInput}
            onChange={(e) => setRouteSearchInput(e.target.value)}
            placeholder="Buscar por origem ou destino"
          />
        </div>
      );
    }

    return (
      <div className={`bg-card p-6 rounded-xl border shadow-sm flex flex-col relative ${disabled ? 'opacity-60' : ''}`}>
        {disabled && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl z-10">
            <div className="flex items-center gap-2 bg-secondary text-secondary-foreground p-2 rounded-md text-sm font-semibold">
              <Lock className="w-4 h-4" /> {disabledTooltip}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
          </div>
          {headerExtras && <div className="w-full sm:w-auto">{headerExtras}</div>}
        </div>
        <div className="flex-grow space-y-3 flex flex-col">
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2 flex-grow">
            {items.length > 0 ? (
              items.map(renderItem)
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>
            )}
          </div>
          <Button onClick={onAdd} className="w-full mt-auto" disabled={disabled}>
            <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Novo
          </Button>
        </div>
      </div>
    );
  };

  const renderInlineAddCard = (title, icon, items, type, isBase, inputValue, setInputValue) => {
      const tableName = type === 'base_city' ? 'base_cities' : (type === 'city' ? 'cities' : 'groups');
      const placeholder = type === 'base_city' ? 'Nome da Cidade Base' : (type === 'city' ? 'Nome da Cidade' : 'Nome do Grupo');
      
      return (
      <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">{icon}<h3 className="text-xl font-bold text-foreground">{title}</h3></div>
          <div className="flex-grow space-y-3 flex flex-col">
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 flex-grow">{items.length > 0 ? items.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-background p-2 rounded-md">
                      <p className="font-semibold text-sm">{item.name}</p>
                      <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setModal({ type, data: item })}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(tableName, item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                  </div>)) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>}
              </div>
              <div className="flex gap-2 mt-auto">
                  <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={placeholder} />
                  <Button onClick={() => handleAddNewInline(type, isBase, inputValue, setInputValue)}><PlusCircle className="w-4 h-4" /></Button>
              </div>
          </div>
      </div>
      );
  }

  const noCities = cities.length === 0;

  const baseFilterId = selectedBaseFilter !== 'all' ? Number(selectedBaseFilter) : null;

  // Debounce dos filtros de busca para evitar recomputar listas a cada tecla
  useEffect(() => {
    const id = setTimeout(() => setSupplierSearch(supplierSearchInput), 250);
    return () => clearTimeout(id);
  }, [supplierSearchInput]);

  useEffect(() => {
    const id = setTimeout(() => setPostoSearch(postoSearchInput), 250);
    return () => clearTimeout(id);
  }, [postoSearchInput]);

  useEffect(() => {
    const id = setTimeout(() => setRouteSearch(routeSearchInput), 250);
    return () => clearTimeout(id);
  }, [routeSearchInput]);

  const sortByLastUpdate = (items) => {
    return [...items].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
  };

  const filteredSuppliersBase = suppliers
    .filter((s) => {
      if (!baseFilterId) return true;
      if (!Array.isArray(s.city_ids)) return false;
      return s.city_ids.includes(baseFilterId);
    })
    .filter((s) => {
      const query = supplierSearch.trim().toLowerCase();
      if (!query) return true;
      const name = (s.name || '').toLowerCase();
      const bandeira = (s.bandeira || '').toLowerCase();
      const baseNames = (s.city_ids || [])
        .map((id) => baseCities.find((c) => c.id === id)?.name?.toLowerCase() || '')
        .join(' ');
      return (
        name.includes(query) ||
        bandeira.includes(query) ||
        baseNames.includes(query)
      );
    });

  const filteredSuppliers =
    sortSuppliersBy === 'name'
      ? [...filteredSuppliersBase].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'pt-BR')
        )
      : sortByLastUpdate(filteredSuppliersBase);

  const filteredPostosBase = postos
    .filter((p) => {
      if (!baseFilterId) return true;
      if (Array.isArray(p.allowed_supply_cities) && p.allowed_supply_cities.length > 0) {
        return p.allowed_supply_cities.includes(baseFilterId);
      }
      return false;
    })
    .filter((p) => {
      const query = postoSearch.trim().toLowerCase();
      if (!query) return true;
      const name = (p.name || '').toLowerCase();
      const cityName = (p.city?.name || '').toLowerCase();
      return name.includes(query) || cityName.includes(query);
    });

  const filteredPostos =
    sortPostosBy === 'name'
      ? [...filteredPostosBase].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'pt-BR')
        )
      : sortPostosBy === 'updated'
      ? sortByLastUpdate(filteredPostosBase)
      : [...filteredPostosBase].sort((a, b) => {
          // Extract number from posto name (e.g., "Cacique 01" -> 1, "Cacique 10" -> 10)
          const aMatch = (a.name || '').match(/\d+/);
          const bMatch = (b.name || '').match(/\d+/);
          const aNum = aMatch ? parseInt(aMatch[0]) : 0;
          const bNum = bMatch ? parseInt(bMatch[0]) : 0;
          return aNum - bNum;
        });

  const filteredFreightRoutesBase = freightRoutes
    .filter((r) => {
      if (!baseFilterId) return true;
      return r.origin_city_id === baseFilterId;
    })
    .filter((r) => {
      const query = routeSearch.trim().toLowerCase();
      if (!query) return true;
      const originName = (r.origin?.name || '').toLowerCase();
      const destinationName = (r.destination?.name || '').toLowerCase();
      return originName.includes(query) || destinationName.includes(query);
    });

  const filteredFreightRoutes =
    sortRoutesBy === 'name'
      ? [...filteredFreightRoutesBase].sort((a, b) => {
          const aKey = `${a.origin?.name || ''} ${a.destination?.name || ''}`.toLowerCase();
          const bKey = `${b.origin?.name || ''} ${b.destination?.name || ''}`.toLowerCase();
          return aKey.localeCompare(bKey, 'pt-BR');
        })
      : sortByLastUpdate(filteredFreightRoutesBase);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 overflow-x-hidden">
      {/* Header Profissional */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
              <div className="relative p-3 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl shadow-2xl">
                <Settings className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">Configurações do Sistema</h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">Gerencie cidades, grupos, fornecedores e postos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-screen-2xl mx-auto">
        {/* Guia Rápido */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg mb-6">
          <div className="p-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Configuração Inicial</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { name: 'Cidades', completed: cities.length > 0, desc: 'Cadastre as cidades' },
                { name: 'Grupos', completed: groups.length > 0, desc: 'Organize os postos' },
                { name: 'Fornecedores', completed: suppliers.length > 0, desc: 'Adicione fornecedores' },
                { name: 'Postos', completed: postos.length > 0, desc: 'Cadastre postos' },
                { name: 'Rotas', completed: freightRoutes.length > 0, desc: 'Defina fretes' }
              ].map((step, index) => (
                <div key={index} className={`p-2 rounded-lg border text-center ${
                  step.completed 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 ${
                    step.completed ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <p className="font-medium text-xs text-slate-900 dark:text-slate-100">{step.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seções de Configuração */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cidades Base */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MapPin className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Cidades Base ({baseCities.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'base_city', data: { name: '' } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {baseCities.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhuma cidade base cadastrada
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {baseCities.map(city => (
                    <div key={city.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-slate-900 dark:text-slate-100">{city.name}</span>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Atualizado: {new Date(city.updated_at || city.created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ type: 'base_city', data: city })}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('base_cities', city.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cidades Destino */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MapPin className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Cidades Destino ({cities.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'city', data: { name: '' } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cities.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhuma cidade destino cadastrada
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {cities.map(city => (
                    <div key={city.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-slate-900 dark:text-slate-100">{city.name}</span>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Atualizado: {new Date(city.updated_at || city.created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ type: 'city', data: city })}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('cities', city.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grupos */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Users className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Grupos de Postos ({groups.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'group', data: { name: '' } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhum grupo cadastrado
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {groups.map(group => (
                    <div key={group.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-slate-900 dark:text-slate-100">{group.name}</span>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Atualizado: {new Date(group.updated_at || group.created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ type: 'group', data: group })}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('groups', group.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fornecedores */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Briefcase className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Fornecedores ({suppliers.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'supplier', data: { name: '', city_ids: [], available_products: [], has_credit: false, payment_term_days: null, payment_notes: '' } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                  disabled={noCities}
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {suppliers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhum fornecedor cadastrado
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {suppliers.map(supplier => {
                    const supplierBaseNames = (supplier.city_ids || [])
                      .map((id) => baseCities.find((c) => c.id === id)?.name)
                      .filter(Boolean);
                    
                    return (
                      <div key={supplier.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{supplier.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Bases: {supplierBaseNames.length > 0 ? supplierBaseNames.slice(0, 2).join(', ') : 'Nenhuma'}
                              {supplierBaseNames.length > 2 && ` +${supplierBaseNames.length - 2}`}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              Atualizado: {new Date(supplier.updated_at || supplier.created_at).toLocaleString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setModal({ type: 'supplier', data: supplier })}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete('suppliers', supplier.id)}
                              className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Postos */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Building className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Meus Postos ({postos.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'posto', data: { name: '', city_id: null, allowed_supply_cities: [], group_ids: [], is_base: false } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                  disabled={noCities}
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {postos.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhum posto cadastrado
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredPostos.map(posto => (
                    <div key={posto.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="truncate">{posto.name}</span>
                            {posto.is_base && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium flex-shrink-0">
                                BASE
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Local: {posto.city?.name || 'N/A'}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Atualizado: {new Date(posto.updated_at || posto.created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ type: 'posto', data: posto })}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('postos', posto.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rotas de Frete */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col h-96">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Truck className="w-4 h-4 text-slate-700 dark:text-slate-300 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Rotas de Frete ({freightRoutes.length})
                  </h3>
                </div>
                <Button
                  onClick={() => setModal({ type: 'route', data: { origin_city_id: null, destination_city_id: null, cost_per_km: null, fixed_cost: null, has_mandatory_return: false, average_toll: null } })}
                  className="bg-blue-600 hover:bg-blue-700 h-8 px-3 text-xs flex-shrink-0"
                  disabled={noCities}
                >
                  <PlusCircle className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {freightRoutes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhuma rota cadastrada
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {freightRoutes.map(route => (
                    <div key={route.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {route.origin?.name || '?'} → {route.destination?.name || '?'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Distância: {route.distance_km || '?'} km
                            {route.fixed_cost && ` + Fixo: R$ ${route.fixed_cost}`}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Atualizado: {new Date(route.updated_at || route.created_at).toLocaleString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setModal({ type: 'route', data: route })}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('freight_routes', route.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Configurações Gerais */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Configurações Gerais</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <GeneralSettingsEditor 
                  title="Tipos de Veículo" 
                  icon={<Car className="w-4 h-4 text-slate-700 dark:text-slate-300" />} 
                  settingsKey="vehicleTypes" 
                  settings={settings} 
                  setSettings={setSettings} 
                  onSave={handleSaveSettings} 
                  fields={{ name: 'Nome', volume: 'Volume (L)' }}
                />
                <GeneralSettingsEditor 
                  title="Tipos de Combustível" 
                  icon={<Droplets className="w-4 h-4 text-slate-700 dark:text-slate-300" />} 
                  settingsKey="fuelTypes" 
                  settings={settings} 
                  setSettings={setSettings} 
                  onSave={handleSaveSettings} 
                  fields={{ name: 'Nome' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modal.type === 'city' && <CityModal data={modal.data} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('cities', d)} />}
        {modal.type === 'group' && <GroupModal data={modal.data} baseCities={baseCities} postos={postos} suppliers={suppliers} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('groups', d)} />}
        {modal.type === 'supplier' && <SupplierModal data={modal.data} baseCities={baseCities} settings={settings} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('suppliers', d)} />}
        {modal.type === 'posto' && <PostoModal data={modal.data} baseCities={baseCities} cities={cities} groups={groups} suppliers={suppliers} settings={settings} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('postos', d)} />}
        {modal.type === 'route' && <RouteModal data={modal.data} baseCities={baseCities} cities={cities} settings={settings} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('freight_routes', d)} />}
      </AnimatePresence>

      {/* Modal de Confirmação */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};

const ModalWrapper = ({ children, title, onClose, onSave, data, wide }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className={`bg-white rounded-lg shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} flex flex-col max-h-[90vh]`} onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gray-50 rounded-t-lg">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            </header>
            <main className="p-4 space-y-4 overflow-y-auto flex-1">{children}</main>
            <footer className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                <Button variant="ghost" onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-gray-800">Cancelar</Button>
                <Button onClick={() => onSave(data)} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
            </footer>
        </motion.div>
    </motion.div>
);
const CityModal = ({ data, onClose, onSave }) => { 
  const [d, setD] = useState(data); 
  return (
    <ModalWrapper title={d.id ? "Editar Cidade" : "Nova Cidade"} data={d} onClose={onClose} onSave={onSave}>
      <div className="space-y-3">
        <div>
          <Label>Nome da Cidade</Label>
          <Input placeholder="Ex: Teresina" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="city_is_base" checked={!!d.is_base} onCheckedChange={(checked) => setD({ ...d, is_base: !!checked })} />
          <label htmlFor="city_is_base" className="text-sm">Esta cidade é uma Base (Fornecedor)</label>
        </div>
      </div>
    </ModalWrapper>
  );
};
const GroupModal = ({ data, baseCities = [], postos = [], suppliers = [], onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onPostoToggle = (id, checked) => setD({ ...d, posto_ids: checked ? [...(d.posto_ids || []), id] : (d.posto_ids || []).filter(i => i !== id) });
    const onBaseCityToggle = (id, checked) => setD({ ...d, base_city_ids: checked ? [...(d.base_city_ids || []), id] : (d.base_city_ids || []).filter(i => i !== id) });
    const onSupplierToggle = (id, checked) => setD({ ...d, allowed_supplier_ids: checked ? [...(d.allowed_supplier_ids || []), id] : (d.allowed_supplier_ids || []).filter(i => i !== id) });

    const bandeiras = [
        { value: 'bandeira_branca', label: 'Bandeira Branca / Independente' },
        { value: 'ipiranga', label: 'Ipiranga' },
        { value: 'shell', label: 'Shell' },
        { value: 'vibra', label: 'Vibra' },
        { value: 'federal', label: 'Federal' }
    ];

    return <ModalWrapper title={d.id ? "Editar Grupo" : "Novo Grupo"} data={d} onClose={onClose} onSave={onSave} wide>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Nome do Grupo</Label>
                <Input placeholder="Ex: Ipiranga Rodovia" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} />
            </div>
            <div>
                <Label>Bandeira do Grupo</Label>
                <Select value={d.bandeira || 'bandeira_branca'} onValueChange={v => setD({ ...d, bandeira: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a bandeira..." /></SelectTrigger>
                    <SelectContent>
                        {bandeiras.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <MultiSelectCheckbox title="Fornecedores Permitidos" options={suppliers} selected={d.allowed_supplier_ids} onToggle={onSupplierToggle} description="Selecione quais fornecedores os postos deste grupo podem comprar" />
        <MultiSelectCheckbox title="Bases de Carregamento" options={baseCities} selected={d.base_city_ids} onToggle={onBaseCityToggle} />
        <MultiSelectCheckbox title="Postos do Grupo" options={postos} selected={d.posto_ids} onToggle={onPostoToggle} />
    </ModalWrapper>; 
};

const MultiSelectCheckbox = ({ title, options, selected, onToggle, description }) => (
    <div>
        <Label className="font-semibold">{title}</Label>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 p-4 border rounded-md bg-background">
            {options.map(option => (
                <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox id={`opt-${option.id}`} checked={(selected || []).includes(option.id)} onCheckedChange={v => onToggle(option.id, v)} />
                    <label htmlFor={`opt-${option.id}`} className="text-sm">{option.name}</label>
                </div>
            ))}
        </div>
    </div>
);

const SupplierModal = ({ data, baseCities, settings, onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onCityToggle = (id, checked) => setD({ ...d, city_ids: checked ? [...(d.city_ids || []), id] : (d.city_ids || []).filter(i => i !== id) });
    const onProductToggle = (key, checked) => setD({ ...d, available_products: checked ? [...(d.available_products || []), key] : (d.available_products || []).filter(i => i !== key) });
    const fuelOptions = Object.entries(settings.fuelTypes || {}).map(([key, value]) => ({ id: key, name: value.name }));

    const bandeiras = [
        { value: 'bandeira_branca', label: 'Bandeira Branca / Independente' },
        { value: 'ipiranga', label: 'Ipiranga' },
        { value: 'shell', label: 'Shell' },
        { value: 'vibra', label: 'Vibra' },
        { value: 'federal', label: 'Federal' }
    ];

    return <ModalWrapper title={d.id ? "Editar Fornecedor" : "Novo Fornecedor"} data={d} onClose={onClose} onSave={onSave} wide>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Nome do Fornecedor</Label>
                <Input placeholder="Ex: Ipiranga" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} />
            </div>
            <div>
                <Label>Bandeira do Fornecedor</Label>
                <Select value={d.bandeira || 'bandeira_branca'} onValueChange={v => setD({ ...d, bandeira: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a bandeira..." /></SelectTrigger>
                    <SelectContent>
                        {bandeiras.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <MultiSelectCheckbox title="Cidades Base de Operação" options={baseCities} selected={d.city_ids} onToggle={onCityToggle} />
        <MultiSelectCheckbox title="Produtos Disponíveis" options={fuelOptions} selected={d.available_products} onToggle={onProductToggle} />
        <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                    <Label>Condição de Pagamento</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Checkbox
                            id="has_credit"
                            checked={!!d.has_credit}
                            onCheckedChange={(checked) => setD({ ...d, has_credit: !!checked })}
                        />
                        <label htmlFor="has_credit" className="text-sm">
                            Permite compra a prazo
                        </label>
                    </div>
                </div>
                <div>
                    <Label>Prazo (dias)</Label>
                    <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 7, 15, 21"
                        value={d.payment_term_days ?? ''}
                        onChange={e => setD({
                            ...d,
                            payment_term_days: e.target.value === '' ? null : parseInt(e.target.value, 10) || 0,
                        })}
                    />
                </div>
                <div className="col-span-3">
                    <Label>Observações de pagamento</Label>
                    <Input
                        placeholder="Ex: prazo só para bandeira branca, volume mínimo, etc."
                        value={d.payment_notes || ''}
                        onChange={e => setD({ ...d, payment_notes: e.target.value })}
                    />
                </div>
            </div>
        </div>
    </ModalWrapper>; 
};

const PostoModal = ({ data, baseCities = [], cities, groups, suppliers = [], settings = {}, onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onSupplyCityToggle = (id, checked) => setD({ ...d, allowed_supply_cities: checked ? [...(d.allowed_supply_cities || []), id] : (d.allowed_supply_cities || []).filter(i => i !== id) });
    const onGroupToggle = (id, checked) => setD({ ...d, group_ids: checked ? [...(d.group_ids || []), id] : (d.group_ids || []).filter(i => i !== id) });
    const onFuelToggle = (key, checked) => setD({ ...d, fuel_types: checked ? [...(d.fuel_types || []), key] : (d.fuel_types || []).filter(i => i !== key) });

    const bandeiras = [
        { value: 'bandeira_branca', label: 'Bandeira Branca' },
        { value: 'ipiranga', label: 'Ipiranga' },
        { value: 'shell', label: 'Shell' },
        { value: 'vibra', label: 'Vibra' }
    ];

    const fuelOptions = Object.keys(settings.fuelTypes || {}).map(key => ({
        id: key,
        name: settings.fuelTypes[key].name
    }));

    // Calcular fornecedores permitidos baseado nos grupos selecionados
    const allowedSupplierIds = new Set();
    (d.group_ids || []).forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group && group.allowed_supplier_ids) {
            group.allowed_supplier_ids.forEach(sid => allowedSupplierIds.add(sid));
        }
    });
    const allowedSuppliers = suppliers.filter(s => allowedSupplierIds.has(s.id));

    return <ModalWrapper title={d.id ? "Editar Posto" : "Novo Posto"} data={d} onClose={onClose} onSave={onSave} wide>
        <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome do Posto</Label><Input placeholder="Ex: Posto Cacique 10" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} /></div>
            <div><Label>Cidade de Localização</Label><Select value={d.city_id || ''} onValueChange={v => setD({ ...d, city_id: v })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Bandeira do Posto</Label>
                <Select value={d.bandeira || 'bandeira_branca'} onValueChange={v => setD({ ...d, bandeira: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a bandeira..." /></SelectTrigger>
                    <SelectContent>
                        {bandeiras.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <MultiSelectCheckbox title="Combustíveis Vendidos" options={fuelOptions} selected={d.fuel_types || []} onToggle={onFuelToggle} />
        <MultiSelectCheckbox title="Grupos do Posto" options={groups} selected={d.group_ids} onToggle={onGroupToggle} />
        <MultiSelectCheckbox title="Bases de Abastecimento Permitidas" options={baseCities} selected={d.allowed_supply_cities} onToggle={onSupplyCityToggle} />
        
        {allowedSuppliers.length > 0 && (
            <div className="mt-2 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <Label className="font-semibold text-blue-900 dark:text-blue-100">ℹ️ Fornecedores Permitidos (baseado nos grupos)</Label>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 mb-2">Este posto pode comprar dos seguintes fornecedores:</p>
                <div className="flex flex-wrap gap-2">
                    {allowedSuppliers.map(supplier => (
                        <span key={supplier.id} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded-md font-medium">
                            {supplier.name}
                        </span>
                    ))}
                </div>
            </div>
        )}
    </ModalWrapper>; 
};

const RouteModal = ({ data, baseCities = [], cities, settings, onClose, onSave }) => { 
    const [d, setD] = useState(() => ({ cargo_type: data.cargo_type || 'granel_liquido', ...data }));
    
    // Manter valores como string no state para permitir digitar "0." sem sumir
    const [costInputs, setCostInputs] = useState(() => {
        const inputs = {};
        if (data.costs) {
            Object.keys(data.costs).forEach(key => {
                inputs[key] = data.costs[key]?.toString() || '';
            });
        }
        return inputs;
    });
    
    const onCost = (k, value) => {
        // Manter como string no input (permite digitar vírgula e ponto)
        setCostInputs(prev => ({ ...prev, [k]: value }));
        
        // Converter vírgula para ponto e depois para número
        const normalizedValue = value.replace(',', '.');
        const numValue = normalizedValue === '' ? 0 : parseFloat(normalizedValue);
        setD({ ...d, costs: { ...d.costs, [k]: isNaN(numValue) ? 0 : numValue }});
    };

    return <ModalWrapper title={d.id ? "Editar Rota" : "Nova Rota"} data={d} onClose={onClose} onSave={onSave} wide>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Origem (Base)</Label>
                <Select value={d.origin_city_id || ''} onValueChange={v => setD({ ...d, origin_city_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{baseCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div>
                <Label>Destino (Cidade)</Label>
                <Select value={d.destination_city_id || ''} onValueChange={v => setD({ ...d, destination_city_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
            <div>
                <Label className="font-semibold">Custos de Frete (R$/L)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 p-4 border rounded-md bg-background">
                    {Object.keys(settings.vehicleTypes).map(k => (
                        <div key={k}>
                            <Label className="text-sm">{settings.vehicleTypes[k].name}</Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                step="0.001"
                                placeholder="0.000"
                                value={costInputs[k] || ''}
                                onChange={e => onCost(k, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <Label className="font-semibold">Distância (km) <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ex: 245.5"
                    value={d.distance_km ?? ''}
                    onChange={e => setD({ ...d, distance_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground mt-1">Informe a distância aproximada entre a base e a cidade destino, caso deseje.</p>
            </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
                <Label className="font-semibold">Parâmetros ANTT (Granel Líquido)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                        <Label>Número de eixos</Label>
                        <Select
                            value={d.axis_count ? String(d.axis_count) : ''}
                            onValueChange={v => setD({ ...d, axis_count: parseInt(v, 10) || null })}
                        >
                            <SelectTrigger><SelectValue placeholder="Ex: 5 eixos" /></SelectTrigger>
                            <SelectContent>
                                {[2, 3, 4, 5, 6, 7, 9].map(eixos => (
                                    <SelectItem key={eixos} value={String(eixos)}>{eixos} eixos</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Tabela ANTT</Label>
                        <Select
                            value={d.antt_table_kind || ''}
                            onValueChange={v => setD({ ...d, antt_table_kind: v })}
                        >
                            <SelectTrigger><SelectValue placeholder="A, B, C ou D" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A">Tabela A (com implemento)</SelectItem>
                                <SelectItem value="B">Tabela B (sem implemento)</SelectItem>
                                <SelectItem value="C">Tabela C (alto desempenho c/ implemento)</SelectItem>
                                <SelectItem value="D">Tabela D (alto desempenho s/ implemento)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                <Label className="font-semibold">Opções de operação</Label>
                <div className="space-y-2 mt-1">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="uses_implement"
                            checked={!!d.uses_implement}
                            onCheckedChange={(checked) => setD({ ...d, uses_implement: !!checked })}
                        />
                        <label htmlFor="uses_implement" className="text-sm">Com implemento (carreta/reboque)</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="is_high_performance"
                            checked={!!d.is_high_performance}
                            onCheckedChange={(checked) => setD({ ...d, is_high_performance: !!checked })}
                        />
                        <label htmlFor="is_high_performance" className="text-sm">Alto desempenho</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="has_mandatory_return"
                            checked={!!d.has_mandatory_return}
                            onCheckedChange={(checked) => setD({ ...d, has_mandatory_return: !!checked })}
                        />
                        <label htmlFor="has_mandatory_return" className="text-sm">Retorno vazio obrigatório</label>
                    </div>
                </div>
                <div>
                    <Label>Pedágio médio na rota (R$)</Label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex: 150.00"
                        value={d.average_toll ?? ''}
                        onChange={e => setD({ ...d, average_toll: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })}
                    />
                </div>
            </div>
        </div>
    </ModalWrapper>; 
};

const GeneralSettingsEditor = ({ title, icon, settingsKey, settings, setSettings, onSave, fields }) => {
    const items = settings[settingsKey] || {};
    const handleItemChange = (key, field, value) => {
        const updatedItems = { ...items, [key]: { ...items[key], [field]: value }};
        setSettings({...settings, [settingsKey]: updatedItems });
    };
    const handleAddItem = () => {
        const newKey = `item_${Date.now()}`;
        const newItem = Object.keys(fields).reduce((acc, field) => ({...acc, [field]: ''}), {});
        if (Object.keys(fields).includes('volume')) {
            newItem.volume = 0;
        }
        setSettings({...settings, [settingsKey]: {...items, [newKey]: newItem }});
    };
    const handleRemoveItem = (key) => {
        const {[key]: _, ...rest} = items;
        setSettings({...settings, [settingsKey]: rest});
    };
    return (
        <div>
            <div className="flex items-center gap-3 mb-4">{icon}<h4 className="text-lg font-bold text-foreground">{title}</h4></div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {Object.keys(items).map(key => (
                    <div key={key} className="flex gap-2 items-center p-2 bg-background rounded-md">
                        {Object.entries(fields).map(([fieldKey, fieldLabel]) => (
                             <Input key={fieldKey} placeholder={fieldLabel} value={items[key][fieldKey] || ''} onChange={e => handleItemChange(key, fieldKey, e.target.value)} type={fieldKey === 'volume' ? 'number' : 'text'}/>
                        ))}
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(key)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 mt-4">
                <Button onClick={handleAddItem} className="w-full"><PlusCircle className="w-4 h-4 mr-2"/> Adicionar</Button>
                <Button onClick={onSave}><Save className="w-4 h-4 mr-2"/> Salvar Gerais</Button>
            </div>
        </div>
    );
};

export default SettingsPage;
