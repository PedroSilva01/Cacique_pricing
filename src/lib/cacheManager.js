// Cache Manager - Sistema unificado para cache de dados
import { supabase } from './customSupabaseClient';
import { priceCacheService } from './priceCacheService';

class CacheManager {
  constructor() {
    this.cacheService = priceCacheService;
  }

  // ===== CONFIGURAÇÕES =====
  
  // Função unificada para buscar configurações do usuário com cache
  async getUserConfigData(userId) {
    try {
      
      // Tentar buscar tudo do cache primeiro
      const [settingsCache, groupsCache, postosCache, suppliersCache, baseCitiesCache] = await Promise.all([
        this.cacheService.getUserSettings(userId),
        this.cacheService.getGroups(userId),
        this.cacheService.getPostos(userId),
        this.cacheService.getSuppliers(userId),
        this.cacheService.getBaseCities(userId)
      ]);

      // Identificar o que precisa ser buscado do Supabase
      const toBeFetched = [];
      if (!settingsCache) toBeFetched.push('settings');
      if (!groupsCache) toBeFetched.push('groups');
      if (!postosCache) toBeFetched.push('postos');
      if (!suppliersCache) toBeFetched.push('suppliers');
      if (!baseCitiesCache) toBeFetched.push('base_cities');

      let freshData = {};

      // Se há dados para buscar, buscar tudo de uma vez para otimizar
      if (toBeFetched.length > 0) {
        console.log(`💿 Cache MISS para: ${toBeFetched.join(', ')} - buscando do Supabase...`);
        
        const queries = [];
        
        if (toBeFetched.includes('settings')) {
          queries.push(
            supabase.from('user_settings').select('*').eq('user_id', userId).limit(1)
              .then(res => ({ type: 'settings', data: res.data && res.data.length > 0 ? res.data[0] : null, error: res.error }))
          );
        }
        
        if (toBeFetched.includes('groups')) {
          queries.push(
            supabase.from('groups').select('*').eq('user_id', userId)
              .then(res => ({ type: 'groups', data: res.data, error: res.error }))
          );
        }
        
        if (toBeFetched.includes('postos')) {
          queries.push(
            supabase.from('postos').select('*').eq('user_id', userId)
              .then(res => ({ type: 'postos', data: res.data, error: res.error }))
          );
        }
        
        if (toBeFetched.includes('suppliers')) {
          queries.push(
            supabase.from('suppliers').select('*').eq('user_id', userId)
              .then(res => ({ type: 'suppliers', data: res.data, error: res.error }))
          );
        }
        
        if (toBeFetched.includes('base_cities')) {
          queries.push(
            supabase.from('base_cities').select('*').eq('user_id', userId)
              .then(res => ({ type: 'base_cities', data: res.data, error: res.error }))
          );
        }

        // Executar todas as queries em paralelo
        const results = await Promise.all(queries);
        
        // Processar resultados e cachear
        for (const result of results) {
          if (result.error) {
                continue;
          }
          
          freshData[result.type] = result.data;
          
          // Cachear dados frescos
          switch (result.type) {
            case 'settings':
              await this.cacheService.setUserSettings(userId, result.data);
              break;
            case 'groups':
              await this.cacheService.setGroups(userId, result.data);
              break;
            case 'postos':
              await this.cacheService.setPostos(userId, result.data);
              break;
            case 'suppliers':
              await this.cacheService.setSuppliers(userId, result.data);
              break;
            case 'base_cities':
              await this.cacheService.setBaseCities(userId, result.data);
              break;
          }
        }
      }

      // Montar resultado final combinando cache + dados frescos
      const result = {
        settings: settingsCache || freshData.settings || {},
        groups: groupsCache || freshData.groups || [],
        postos: postosCache || freshData.postos || [],
        suppliers: suppliersCache || freshData.suppliers || [],
        baseCities: baseCitiesCache || freshData.base_cities || [],
        source: toBeFetched.length === 0 ? 'cache' : toBeFetched.length === 5 ? 'supabase' : 'mixed'
      };

      
      return { data: result, error: null };
      
    } catch (error) {
      return { data: null, error };
    }
  }

  // ===== FRETES =====
  
  async getFreightData(userId) {
    try {
      // Tentar cache primeiro
      const cached = await this.cacheService.getFreightRoutes(userId);
      
      if (cached) {
          return { data: cached, error: null, source: 'cache' };
      }

      
      const { data, error } = await supabase
        .from('freight_routes')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Cachear dados
      if (data) {
        await this.cacheService.setFreightRoutes(userId, data);
      }

      return { data: data || [], error: null, source: 'supabase' };
      
    } catch (error) {
      return { data: [], error };
    }
  }

  // ===== PEDIDOS =====
  
  async getPurchaseOrdersData(userId, options = {}) {
    try {
      const { useCache = true, dateFrom, dateTo } = options;
      
      // Para consultas com filtros específicos, sempre buscar do Supabase
      // Cache é usado apenas para "todos os pedidos"
      if (dateFrom || dateTo || !useCache) {
        return await this.fetchPurchaseOrdersFromSupabase(userId, options);
      }
      
      // Tentar cache primeiro
      const cached = await this.cacheService.getPurchaseOrders(userId);
      
      if (cached) {
          return { data: cached, error: null, source: 'cache' };
      }

      
      const result = await this.fetchPurchaseOrdersFromSupabase(userId, options);
      
      // Cachear apenas se foi busca geral (sem filtros) e payload não for muito grande
      if (!dateFrom && !dateTo && result.data && result.data.length <= 20) {
        try {
          await this.cacheService.setPurchaseOrders(userId, result.data);
        } catch (cacheError) {
            // Continuar funcionando mesmo sem cache
        }
      }

      return result;
      
    } catch (error) {
      return { data: [], error };
    }
  }

  async fetchPurchaseOrdersFromSupabase(userId, options = {}) {
    const { dateFrom, dateTo } = options;
    
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .eq('user_id', userId);

    // Se não houver filtros específicos, limitar aos últimos 15 dias e máximo 20 pedidos para cache
    if (!dateFrom && !dateTo) {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      query = query.gte('order_date', fifteenDaysAgo.toISOString().split('T')[0]).limit(20);
    } else {
      if (dateFrom) query = query.gte('order_date', dateFrom);
      if (dateTo) query = query.lte('order_date', dateTo);
    }

    const { data, error } = await query.order('order_date', { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null, source: 'supabase' };
  }

  // ===== INVALIDAÇÃO =====
  
  // Invalidar cache quando configurações mudam
  async invalidateConfigCache(userId) {
    return await this.cacheService.invalidateUserConfigurations(userId);
  }

  // Invalidar cache quando pedidos são adicionados/modificados
  async invalidateOrdersCache(userId) {
    return await this.cacheService.invalidateUserOrders(userId);
  }

  // Invalidar tudo quando usuário faz logout
  async invalidateAllCache(userId) {
    return await this.cacheService.invalidateAllUserCache(userId);
  }

  // ===== UTILITÁRIOS =====
  
  // Buscar TODOS os pedidos sem limitação (para dashboard)
  async getAllPurchaseOrders(userId) {
    try {
      
      // Buscar direto do Supabase sem limitação
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('user_id', userId)
        .order('order_date', { ascending: false });

      if (error) throw error;

      return { data: data || [], error: null, source: 'supabase' };
      
    } catch (error) {
      console.error('❌ Erro ao buscar todos os purchase orders:', error);
      return { data: [], error };
    }
  }
  
  // Função helper para páginas que precisam de "tudo"
  async getAllUserData(userId) {
    try {
      
      const [configResult, freightResult, ordersResult] = await Promise.all([
        this.getUserConfigData(userId),
        this.getFreightData(userId),
        this.getAllPurchaseOrders(userId) // Usar função sem limitação
      ]);

      const result = {
        // Configurações
        settings: configResult.data?.settings || {},
        groups: configResult.data?.groups || [],
        postos: configResult.data?.postos || [],
        suppliers: configResult.data?.suppliers || [],
        baseCities: configResult.data?.baseCities || [],
        
        // Fretes
        freightRoutes: freightResult.data || [],
        
        // Pedidos
        purchaseOrders: ordersResult.data || [],
        
        // Metadados
        sources: {
          config: configResult.data?.source || 'error',
          freight: freightResult.source || 'error',
          orders: ordersResult.source || 'error'
        },
        errors: {
          config: configResult.error,
          freight: freightResult.error,
          orders: ordersResult.error
        }
      };

      return { data: result, error: null };
      
    } catch (error) {
      return { data: null, error };
    }
  }
}

// Export singleton
export const cacheManager = new CacheManager();
export default cacheManager;
