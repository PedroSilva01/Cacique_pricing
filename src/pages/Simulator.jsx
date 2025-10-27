import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calculator, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { defaultSettings } from '@/lib/mockData';
import BestPricesComparison from '@/components/BestPricesComparison';
import { Button } from '@/components/ui/button';

const Simulator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(defaultSettings);
  const [cities, setCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [freightRoutes, setFreightRoutes] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [settingsRes, citiesRes, suppliersRes, postosRes, groupsRes, routesRes] = await Promise.all([
        supabase.from('user_settings').select('settings').eq('user_id', user.id).maybeSingle(),
        supabase.from('cities').select('*').eq('user_id', user.id),
        supabase.from('suppliers').select('*').eq('user_id', user.id),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', user.id),
        supabase.from('groups').select('*').eq('user_id', user.id),
        supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', user.id),
      ]);

      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (postosRes.error) throw postosRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (routesRes.error) throw routesRes.error;

      setSettings(settingsRes.data?.settings || defaultSettings);
      setCities(citiesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setPostos(postosRes.data || []);
      setGroups(groupsRes.data || []);
      setFreightRoutes(routesRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({
        title: 'Erro ao carregar dados',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calculator className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Simulador de Preços</h1>
            <p className="text-muted-foreground">
              Compare fornecedores, bases e calcule a melhor opção de compra
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Best Prices Comparison Component */}
      <BestPricesComparison
        settings={settings}
        cities={cities}
        suppliers={suppliers}
        postos={postos}
        groups={groups}
        freightRoutes={freightRoutes}
      />
    </motion.div>
  );
};

export default Simulator;
