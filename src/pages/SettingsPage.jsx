import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, PlusCircle, Trash2, Edit, Briefcase, Truck, MapPin, Building, Droplets, Car, Users, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { defaultSettings } from '@/lib/mockData';
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
  
  // Estado para modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'danger'
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [baseCitiesRes, citiesRes, suppliersRes, postosRes, routesRes, settingsRes, groupsRes] = await Promise.all([
        supabase.from('base_cities').select('*').eq('user_id', user.id).order('name'),
        supabase.from('cities').select('*').eq('user_id', user.id).order('name'),
        supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', user.id).order('name'),
        supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', user.id),
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
        supabase.from('groups').select('*').eq('user_id', user.id).order('name'),
      ]);

      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (postosRes.error) throw postosRes.error;
      if (routesRes.error) throw routesRes.error;
      if (groupsRes.error && groupsRes.error.code !== 'PGRST116') throw groupsRes.error;

      setBaseCities(baseCitiesRes.data || []);
      setCities(citiesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setPostos(postosRes.data || []);
      setFreightRoutes(routesRes.data || []);
      setGroups(groupsRes.data || []);
      if (settingsRes.data?.settings) {
        setSettings(settingsRes.data.settings);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar dados', description: `Falha ao buscar as configurações: ${error.message}`, variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      
      const { error } = await supabase.from(tableName).upsert(record).select().single();
      if (error) throw error;
      
      await fetchData();
      toast({ title: 'Sucesso!', description: 'Item salvo com sucesso.' });
      setModal({ type: null, data: null });
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
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
          toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
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
        toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
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

  const renderCard = (title, icon, items, renderItem, onAdd, disabled = false, disabledTooltip = '') => (
    <div className={`bg-card p-6 rounded-xl border shadow-sm flex flex-col relative ${disabled ? 'opacity-60' : ''}`}>
      {disabled && <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl z-10"><div className="flex items-center gap-2 bg-secondary text-secondary-foreground p-2 rounded-md text-sm font-semibold"><Lock className="w-4 h-4" /> {disabledTooltip}</div></div>}
      <div className="flex items-center gap-3 mb-4">{icon}<h3 className="text-xl font-bold text-foreground">{title}</h3></div>
      <div className="flex-grow space-y-3 flex flex-col">
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 flex-grow">{items.length > 0 ? items.map(renderItem) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>}</div>
        <Button onClick={onAdd} className="w-full mt-auto" disabled={disabled}><PlusCircle className="w-4 h-4 mr-2" /> Adicionar Novo</Button>
      </div>
    </div>
  );

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
      
      <SetupGuide cities={cities} groups={groups} suppliers={suppliers} postos={postos} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {renderInlineAddCard("Cidades Base (Fornecedores)", <MapPin className="w-6 h-6 text-primary" />, baseCities, 'base_city', undefined, newBaseCityName, setNewBaseCityName)}
        {renderInlineAddCard("Cidades Destino", <MapPin className="w-6 h-6 text-secondary" />, cities, 'city', undefined, newCityName, setNewCityName)}
        {renderInlineAddCard("Grupos de Postos", <Users className="w-6 h-6 text-primary" />, groups, 'group', undefined, newEntityName.group, (v) => setNewEntityName(prev => ({...prev, group: v})))}

        {renderCard("Fornecedores", <Briefcase className="w-6 h-6 text-primary" />, suppliers, (s) => (
            <div key={s.id} className="flex items-center justify-between bg-background p-2 rounded-md">
                <div><p className="font-semibold text-sm">{s.name}</p><p className="text-xs text-muted-foreground">Bases: {s.cities?.map(c => c.name).join(', ') || 'Nenhuma'}</p></div>
                <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setModal({ type: 'supplier', data: s })}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete('suppliers', s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>
            </div>
        ), () => setModal({ type: 'supplier', data: { name: '', city_ids: [], available_products: [] } }), noCities, "Adicione cidades primeiro")}
        
        {renderCard("Meus Postos", <Building className="w-6 h-6 text-primary" />, postos, (p) => (
            <div key={p.id} className="flex items-center justify-between bg-background p-2 rounded-md">
                <div>
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {p.name}
                    {p.is_base && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">BASE</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Local: {p.city?.name || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setModal({ type: 'posto', data: p })}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete('postos', p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>
            </div>
        ), () => setModal({ type: 'posto', data: { name: '', city_id: null, allowed_supply_cities: [], group_ids: [], is_base: false } }), noCities, "Adicione cidades primeiro")}
        
        {renderCard("Rotas de Frete", <Truck className="w-6 h-6 text-primary" />, freightRoutes, (r) => (
            <div key={r.id} className="flex items-center justify-between bg-background p-2 rounded-md">
                <p className="font-semibold text-sm">{r.origin?.name || '?'} → {r.destination?.name || '?'}</p>
                <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setModal({ type: 'route', data: r })}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete('freight_routes', r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>
            </div>
        ), () => setModal({ type: 'route', data: { origin_city_id: null, destination_city_id: null, costs: {} } }), noCities, "Adicione cidades primeiro")}
        
        <div className="bg-card p-6 rounded-xl border shadow-sm md:col-span-2 lg:col-span-3 xl:col-span-4">
          <h3 className="text-xl font-bold text-foreground mb-4">Configurações Gerais</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <GeneralSettingsEditor title="Tipos de Veículo" icon={<Car className="w-6 h-6 text-primary" />} settingsKey="vehicleTypes" settings={settings} setSettings={setSettings} onSave={handleSaveSettings} fields={{ name: 'Nome', volume: 'Volume (L)'}}/>
            <GeneralSettingsEditor title="Tipos de Combustível" icon={<Droplets className="w-6 h-6 text-primary" />} settingsKey="fuelTypes" settings={settings} setSettings={setSettings} onSave={handleSaveSettings} fields={{ name: 'Nome'}}/>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modal.type === 'city' && <CityModal data={modal.data} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('cities', d)} />}
        {modal.type === 'group' && <GroupModal data={modal.data} baseCities={baseCities} postos={postos} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('groups', d)} />}
        {modal.type === 'supplier' && <SupplierModal data={modal.data} cities={cities} settings={settings} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('suppliers', d)} />}
        {modal.type === 'posto' && <PostoModal data={modal.data} baseCities={baseCities} cities={cities} groups={groups} onClose={() => setModal({ type: null })} onSave={(d) => handleSave('postos', d)} />}
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
    </motion.div>
  );
};

const ModalWrapper = ({ children, title, onClose, onSave, data, wide }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className={`bg-card rounded-lg p-0 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} flex flex-col max-h-[90vh]`} onClick={e => e.stopPropagation()}>
            <header className="p-6 border-b"><h3 className="text-lg font-bold">{title}</h3></header>
            <main className="p-6 space-y-4 overflow-y-auto">{children}</main>
            <footer className="p-4 border-t flex justify-end gap-2 bg-background/50"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(data)}><Save className="w-4 h-4 mr-2" /> Salvar</Button></footer>
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
const GroupModal = ({ data, baseCities = [], postos = [], onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onPostoToggle = (id, checked) => setD({ ...d, posto_ids: checked ? [...(d.posto_ids || []), id] : (d.posto_ids || []).filter(i => i !== id) });

    return <ModalWrapper title={d.id ? "Editar Grupo" : "Novo Grupo"} data={d} onClose={onClose} onSave={onSave} wide>
        <Label>Nome do Grupo</Label>
        <Input placeholder="Ex: Ipiranga Rodovia" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} />
        
        <div>
            <Label>Base de Carregamento</Label>
            <Select value={d.base_city_id || ''} onValueChange={v => setD({ ...d, base_city_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a base..." /></SelectTrigger>
                <SelectContent>
                    {baseCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Um posto pode estar em múltiplos grupos, desde que sejam de bases diferentes</p>
        </div>

        <MultiSelectCheckbox title="Postos do Grupo" options={postos} selected={d.posto_ids} onToggle={onPostoToggle} />
    </ModalWrapper>; 
};

const MultiSelectCheckbox = ({ title, options, selected, onToggle }) => (
    <div>
        <Label className="font-semibold">{title}</Label>
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

const SupplierModal = ({ data, cities, settings, onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onCityToggle = (id, checked) => setD({ ...d, city_ids: checked ? [...(d.city_ids || []), id] : (d.city_ids || []).filter(i => i !== id) });
    const onProductToggle = (key, checked) => setD({ ...d, available_products: checked ? [...(d.available_products || []), key] : (d.available_products || []).filter(i => i !== key) });
    const fuelOptions = Object.entries(settings.fuelTypes || {}).map(([key, value]) => ({ id: key, name: value.name }));

    return <ModalWrapper title={d.id ? "Editar Fornecedor" : "Novo Fornecedor"} data={d} onClose={onClose} onSave={onSave} wide>
        <Label>Nome do Fornecedor</Label>
        <Input placeholder="Ex: Ipiranga" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} />
        <MultiSelectCheckbox title="Cidades (Bases) de Operação" options={cities} selected={d.city_ids} onToggle={onCityToggle} />
        <MultiSelectCheckbox title="Produtos Disponíveis" options={fuelOptions} selected={d.available_products} onToggle={onProductToggle} />
    </ModalWrapper>; 
};

const PostoModal = ({ data, baseCities = [], cities, groups, onClose, onSave }) => { 
    const [d, setD] = useState(data); 
    const onSupplyCityToggle = (id, checked) => setD({ ...d, allowed_supply_cities: checked ? [...(d.allowed_supply_cities || []), id] : (d.allowed_supply_cities || []).filter(i => i !== id) });
    const onGroupToggle = (id, checked) => setD({ ...d, group_ids: checked ? [...(d.group_ids || []), id] : (d.group_ids || []).filter(i => i !== id) });

    return <ModalWrapper title={d.id ? "Editar Posto" : "Novo Posto"} data={d} onClose={onClose} onSave={onSave} wide>
        <div className="grid grid-cols-2 gap-4">
            <div><Label>Nome do Posto</Label><Input placeholder="Ex: Posto Cacique 10" value={d.name || ''} onChange={e => setD({ ...d, name: e.target.value })} /></div>
            <div><Label>Cidade de Localização</Label><Select value={d.city_id || ''} onValueChange={v => setD({ ...d, city_id: v })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <MultiSelectCheckbox title="Grupos do Posto" options={groups} selected={d.group_ids} onToggle={onGroupToggle} />
        <MultiSelectCheckbox title="Bases de Abastecimento Permitidas" options={baseCities} selected={d.allowed_supply_cities} onToggle={onSupplyCityToggle} />
    </ModalWrapper>; 
};

const RouteModal = ({ data, baseCities = [], cities, settings, onClose, onSave }) => { 
    const [d, setD] = useState(data);
    
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
            <div><Label>Origem (Base)</Label><Select value={d.origin_city_id || ''} onValueChange={v => setD({ ...d, origin_city_id: v })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{baseCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Destino (Cidade)</Label><Select value={d.destination_city_id || ''} onValueChange={v => setD({ ...d, destination_city_id: v })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div><Label className="font-semibold">Custos de Frete (R$/L)</Label><div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 p-4 border rounded-md bg-background">{Object.keys(settings.vehicleTypes).map(k => <div key={k}><Label className="text-sm">{settings.vehicleTypes[k].name}</Label><Input type="text" inputMode="decimal" step="0.001" placeholder="0.000" value={costInputs[k] || ''} onChange={e => onCost(k, e.target.value)} /></div>)}</div></div>
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
