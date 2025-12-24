import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { defaultSettings } from '@/lib/mockData';

export const useDashboardData = (userId, { onError } = {}) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(defaultSettings);
  const [dailyPrices, setDailyPrices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [baseCities, setBaseCities] = useState([]);
  const [cities, setCities] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [freightRoutes, setFreightRoutes] = useState([]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [
        settingsRes,
        pricesRes,
        suppliersRes,
        baseCitiesRes,
        citiesRes,
        postosRes,
        routesRes,
        groupsRes,
      ] = await Promise.all([
        supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
        supabase
          .from('daily_prices')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('base_cities').select('*').eq('user_id', userId).order('name'),
        supabase.from('cities').select('*').eq('user_id', userId).order('name'),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', userId),
        supabase
          .from('freight_routes')
          .select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)')
          .eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
      ]);

      if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (baseCitiesRes.error) throw baseCitiesRes.error;
      if (citiesRes.error) throw citiesRes.error;
      if (postosRes.error) throw postosRes.error;
      if (routesRes.error) throw routesRes.error;
      if (groupsRes.error) throw groupsRes.error;

      const userSettings = settingsRes.data?.settings || defaultSettings;

      setSettings(userSettings);
      setDailyPrices(pricesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setBaseCities(baseCitiesRes.data || []);
      setCities(citiesRes.data || []);
      setPostos(postosRes.data || []);
      setFreightRoutes(routesRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    settings,
    dailyPrices,
    suppliers,
    baseCities,
    cities,
    postos,
    groups,
    freightRoutes,
    refetch: fetchData,
  };
};
