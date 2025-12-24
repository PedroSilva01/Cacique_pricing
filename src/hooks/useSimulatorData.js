import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { defaultSettings } from '@/lib/mockData';

export const useSimulatorData = (userId, { onError } = {}) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(defaultSettings);
  const [cities, setCities] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [postos, setPostos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [freightRoutes, setFreightRoutes] = useState([]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [settingsRes, citiesRes, suppliersRes, postosRes, groupsRes, routesRes] = await Promise.all([
        supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle(),
        supabase.from('cities').select('*').eq('user_id', userId),
        supabase.from('suppliers').select('*').eq('user_id', userId),
        supabase.from('postos').select('*, city:cities(id, name)').eq('user_id', userId),
        supabase.from('groups').select('*').eq('user_id', userId),
        supabase.from('freight_routes').select('*, origin:base_cities!origin_city_id(id, name), destination:cities!destination_city_id(id, name)').eq('user_id', userId),
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
      console.error('Error fetching simulator data:', err);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    settings,
    cities,
    suppliers,
    postos,
    groups,
    freightRoutes,
    refetch: fetchData,
  };
};
