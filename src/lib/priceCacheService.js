import { supabase } from '@/lib/customSupabaseClient';
import { priceCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redisClient';
import { RequestBatcher, requestDeduplicator, performanceMonitor } from '@/lib/performance';
import { validatePriceData, rateLimiter, SECURITY_LIMITS } from '@/lib/security';

export class PriceCacheService {
  constructor() {
    this.cache = priceCache;
    this.batcher = new RequestBatcher(5, 200); // Batch Redis operations
    this.compressionEnabled = true;
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      errors: 0
    };
  }

  // ================================
  // DAILY PRICES OPERATIONS
  // ================================

  // Cache key generators for daily prices
  getDailyPriceCacheKey(date, userId, groupId = null, baseId = null, supplierId = null) {
    const parts = ['daily_prices', date, userId];
    if (groupId) parts.push(`group_${groupId}`);
    if (baseId) parts.push(`base_${baseId}`);
    if (supplierId) parts.push(`supplier_${supplierId}`);
    return `cacique:${parts.join(':')}`;
  }

  // Save daily prices with caching
  async saveDailyPrices(priceData) {
    try {
      performanceMonitor.mark('saveDailyPrices_start');
      
      // Security validation
      const validation = validatePriceData(priceData);
      if (!validation.isValid) {
        console.error('❌ Price data validation failed:', validation.errors);
        return { data: null, error: new Error('Dados inválidos: ' + validation.errors.join(', ')) };
      }
      
      // Rate limiting
      const rateLimitKey = `save_prices_${validation.sanitized.user_id}`;
      if (!rateLimiter.checkLimit(rateLimitKey, SECURITY_LIMITS.PRICE_SAVE_LIMIT)) {
        return { data: null, error: new Error('Muitas tentativas de salvamento. Tente novamente em 1 minuto.') };
      }
      
      console.log('💾 Saving daily prices with Redis cache...', validation.sanitized);

      // Save to Supabase first
      const { data, error } = await supabase
        .from('daily_prices')
        .insert(validation.sanitized)
        .select();

      if (error) throw error;

      // Cache the saved data
      const savedRecord = data[0];
      if (savedRecord) {
        await this.cacheDailyPrice(savedRecord);
        
        // Also invalidate related caches
        await this.invalidateRelatedCaches(savedRecord);
      }

      this.stats.saves++;
      performanceMonitor.mark('saveDailyPrices_end');
      const duration = performanceMonitor.measure('saveDailyPrices_start', 'saveDailyPrices_end');
      
      console.log(`✅ Daily prices saved and cached successfully (${duration?.toFixed(2)}ms)`);
      return { data, error: null };
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Error saving daily prices:', error);
      return { data: null, error };
    }
  }

  // Cache individual daily price record
  async cacheDailyPrice(priceRecord) {
    try {
      const { date, user_id, group_ids, base_city_id, supplier_id } = priceRecord;

      // Cache by different combinations for flexible retrieval
      const cachePromises = [];

      // Main cache key
      if (group_ids && group_ids.length > 0) {
        for (const groupId of group_ids) {
          const key = this.getDailyPriceCacheKey(date, user_id, groupId, base_city_id, supplier_id);
          cachePromises.push(
            this.cache.set(key, priceRecord, CACHE_TTL.SAVED_PRICES)
          );
        }
      }

      // Cache by date and user for recent prices
      const recentKey = `cacique:recent_prices:${date}:${user_id}`;
      const existingRecent = await this.cache.get(recentKey);
      const recentPrices = existingRecent ? (typeof existingRecent === 'string' ? JSON.parse(existingRecent) : existingRecent) : [];
      
      // Add new record to recent prices (keep last 50 records)
      recentPrices.unshift(priceRecord);
      if (recentPrices.length > 50) {
        recentPrices.splice(50);
      }
      
      cachePromises.push(
        this.cache.set(recentKey, recentPrices, CACHE_TTL.SAVED_PRICES)
      );

      await Promise.all(cachePromises);
      return true;
    } catch (error) {
      console.error('Redis cache error during daily price caching:', error);
      return false;
    }
  }

  // Get daily prices with cache-first approach
  async getDailyPrices(options = {}) {
    const { date, userId, groupIds, baseId, supplierId, useCache = true } = options;
    
    performanceMonitor.mark('getDailyPrices_start');
    
    try {
      let cacheKey = null;
      let cachedData = null;

      // Try cache first if enabled
      if (useCache && groupIds && groupIds.length > 0) {
        cacheKey = this.getDailyPriceCacheKey(date, userId, groupIds[0], baseId, supplierId);
        cachedData = await this.cache.get(cacheKey);
        
        if (cachedData) {
          this.stats.hits++;
          console.log('🚀 Cache HIT for daily prices:', cacheKey);
          const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
          return { data: [parsedData], error: null, source: 'cache' };
        }
      }

      this.stats.misses++;
      console.log('💿 Cache MISS, fetching from Supabase...', { date, userId, groupIds, baseId, supplierId });

      // Build Supabase query
      let query = supabase
        .from('daily_prices')
        .select(`
          id,
          date,
          prices,
          maintained_prices,
          created_at,
          updated_at,
          user_id,
          supplier_id,
          base_city_id,
          group_ids,
          suppliers (name),
          base_cities (name)
        `)
        .eq('user_id', userId);

      if (date) query = query.eq('date', date);
      if (baseId) query = query.eq('base_city_id', baseId);
      if (supplierId) query = query.eq('supplier_id', supplierId);
      if (groupIds && groupIds.length > 0) {
        query = query.overlaps('group_ids', groupIds);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Cache the results with adaptive TTL
      if (data && data.length > 0 && cacheKey) {
        const adaptiveTTL = this.getAdaptiveTTL('daily_prices', data[0]);
        await this.cache.set(cacheKey, data[0], adaptiveTTL);
      }

      performanceMonitor.mark('getDailyPrices_end');
      const duration = performanceMonitor.measure('getDailyPrices_start', 'getDailyPrices_end');
      console.log(`📊 Daily prices query completed (${duration?.toFixed(2)}ms)`);

      return { data, error: null, source: 'supabase' };
    } catch (error) {
      console.error('Error fetching daily prices:', error);
      return { data: null, error };
    }
  }

  // ================================
  // STATION PRICES OPERATIONS
  // ================================

  // Save station prices with caching
  async saveStationPrices(stationPricesData) {
    try {
      console.log('💾 Saving station prices with Redis cache...', stationPricesData);

      // Delete existing records first
      if (stationPricesData.length > 0) {
        const { user_id, date } = stationPricesData[0];
        const stationIds = stationPricesData.map(sp => sp.station_id);

        const { error: deleteError } = await supabase
          .from('station_prices')
          .delete()
          .eq('user_id', user_id)
          .eq('date', date)
          .in('station_id', stationIds);

        if (deleteError) throw deleteError;
      }

      // Save to Supabase
      const { data, error } = await supabase
        .from('station_prices')
        .insert(stationPricesData)
        .select();

      if (error) throw error;

      // Cache the saved data
      if (data) {
        for (const record of data) {
          await this.cacheStationPrice(record);
        }
      }

      console.log('✅ Station prices saved and cached successfully');
      return { data, error: null };
    } catch (error) {
      console.error('❌ Error saving station prices:', error);
      return { data: null, error };
    }
  }

  // Cache individual station price record
  async cacheStationPrice(stationPriceRecord) {
    try {
      const { date, user_id, station_id } = stationPriceRecord;
      const key = `cacique:station_prices:${date}:${user_id}:${station_id}`;
      
      await this.cache.set(key, stationPriceRecord, CACHE_TTL.SAVED_PRICES);
      return true;
    } catch (error) {
      console.error('Redis cache error during station price caching:', error);
      return false;
    }
  }

  // === CONFIGURAÇÕES CACHE ===

  async getUserSettings(userId) {
    const key = CACHE_KEYS.USER_SETTINGS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setUserSettings(userId, settings) {
    const key = CACHE_KEYS.USER_SETTINGS(userId);
    return await this.cache.set(key, settings, CACHE_TTL.SETTINGS);
  }

  async getGroups(userId) {
    const key = CACHE_KEYS.GROUPS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setGroups(userId, groups) {
    const key = CACHE_KEYS.GROUPS(userId);
    return await this.cache.set(key, groups, CACHE_TTL.GROUPS);
  }

  async getPostos(userId) {
    const key = CACHE_KEYS.POSTOS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setPostos(userId, postos) {
    const key = CACHE_KEYS.POSTOS(userId);
    return await this.cache.set(key, postos, CACHE_TTL.POSTOS);
  }

  async getSuppliers(userId) {
    const key = CACHE_KEYS.SUPPLIERS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setSuppliers(userId, suppliers) {
    const key = CACHE_KEYS.SUPPLIERS(userId);
    return await this.cache.set(key, suppliers, CACHE_TTL.SUPPLIERS);
  }

  async getBaseCities(userId) {
    const key = CACHE_KEYS.BASE_CITIES(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setBaseCities(userId, baseCities) {
    const key = CACHE_KEYS.BASE_CITIES(userId);
    return await this.cache.set(key, baseCities, CACHE_TTL.BASE_CITIES);
  }

  // === FRETES CACHE ===

  async getFreightRoutes(userId) {
    const key = CACHE_KEYS.FREIGHT_ROUTES(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setFreightRoutes(userId, freightRoutes) {
    const key = CACHE_KEYS.FREIGHT_ROUTES(userId);
    return await this.cache.set(key, freightRoutes, CACHE_TTL.FREIGHT_ROUTES);
  }

  // === PEDIDOS CACHE ===

  async getPurchaseOrders(userId) {
    const key = CACHE_KEYS.PURCHASE_ORDERS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setPurchaseOrders(userId, orders) {
    const key = CACHE_KEYS.PURCHASE_ORDERS(userId);
    return await this.cache.set(key, orders, CACHE_TTL.PURCHASE_ORDERS);
  }

  async getUserOrders(userId) {
    const key = CACHE_KEYS.USER_ORDERS(userId);
    const cached = await this.cache.get(key);
    return cached || null;
  }

  async setUserOrders(userId, orders) {
    const key = CACHE_KEYS.USER_ORDERS(userId);
    return await this.cache.set(key, orders, CACHE_TTL.USER_ORDERS);
  }

  // === INVALIDAÇÃO INTELIGENTE ===

  async invalidateUserSettings(userId) {
    const key = CACHE_KEYS.USER_SETTINGS(userId);
    return await this.cache.del(key);
  }

  async invalidateUserConfigurations(userId) {
    // Invalidar todas as configurações quando houver mudança
    const keys = [
      CACHE_KEYS.USER_SETTINGS(userId),
      CACHE_KEYS.GROUPS(userId),
      CACHE_KEYS.POSTOS(userId),
      CACHE_KEYS.SUPPLIERS(userId),
      CACHE_KEYS.BASE_CITIES(userId)
    ];
    return Promise.all(keys.map(key => this.cache.del(key)));
  }

  async invalidateUserOrders(userId) {
    // Invalidar cache de pedidos quando houver inserção/alteração
    const keys = [
      CACHE_KEYS.PURCHASE_ORDERS(userId),
      CACHE_KEYS.USER_ORDERS(userId)
    ];
    return Promise.all(keys.map(key => this.cache.del(key)));
  }

  // Batch invalidation for updates
  async invalidateAllUserData(userId) {
    const userKey = CACHE_KEYS.USER_PRICES(userId);
    const generalKey = CACHE_KEYS.SAVED_PRICES;
    return Promise.all([
      this.cache.del(userKey),
      this.cache.del(generalKey)
    ]);
  }

  // Invalidar TUDO quando usuário faz logout ou mudanças grandes
  async invalidateAllUserCache(userId) {
    const allKeys = [
      // Preços
      CACHE_KEYS.USER_PRICES(userId),
      // Configurações
      CACHE_KEYS.USER_SETTINGS(userId),
      CACHE_KEYS.GROUPS(userId),
      CACHE_KEYS.POSTOS(userId),
      CACHE_KEYS.SUPPLIERS(userId),
      CACHE_KEYS.BASE_CITIES(userId),
      CACHE_KEYS.FREIGHT_ROUTES(userId),
      // Pedidos
      CACHE_KEYS.PURCHASE_ORDERS(userId),
      CACHE_KEYS.USER_ORDERS(userId)
    ];
    return Promise.all(allKeys.map(key => this.cache.del(key)));
  }

  // Get station prices with cache-first approach
  async getStationPrices(date, userId, stationIds, useCache = true) {
    try {
      const results = [];
      const uncachedStationIds = [];

      // Check cache for each station
      if (useCache) {
        for (const stationId of stationIds) {
          const key = `cacique:station_prices:${date}:${userId}:${stationId}`;
          const cached = await this.cache.get(key);
          
          if (cached) {
            const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
            results.push(parsedData);
          } else {
            uncachedStationIds.push(stationId);
          }
        }

        console.log(`🚀 Cache HIT for ${results.length}/${stationIds.length} station prices`);
      } else {
        uncachedStationIds.push(...stationIds);
      }

      // Fetch uncached data from Supabase
      if (uncachedStationIds.length > 0) {
        console.log('💿 Fetching uncached station prices from Supabase...', uncachedStationIds);
        
        const { data, error } = await supabase
          .from('station_prices')
          .select('*')
          .eq('user_id', userId)
          .eq('date', date)
          .in('station_id', uncachedStationIds);

        if (error) throw error;

        if (data) {
          // Cache the fetched data
          for (const record of data) {
            await this.cacheStationPrice(record);
            results.push(record);
          }
        }
      }

      return { data: results, error: null, source: results.length === stationIds.length ? 'cache' : 'mixed' };
    } catch (error) {
      console.error('Error fetching station prices:', error);
      return { data: null, error };
    }
  }

  // ================================
  // RECENT PRICES OPERATIONS
  // ================================

  // Get recent prices with caching (for PriceEntry history)
  async getRecentPrices(date, userId, useCache = true) {
    try {
      // Rate limiting for searches
      const rateLimitKey = `recent_prices_${userId}`;
      if (!rateLimiter.checkLimit(rateLimitKey, SECURITY_LIMITS.SEARCH_LIMIT)) {
        throw new Error('Muitas consultas. Tente novamente em 1 minuto.');
      }
      
      const cacheKey = `cacique:recent_prices:${date}:${userId}`;
      
      // Use request deduplication for concurrent requests
      return requestDeduplicator.request(`recent_prices_${date}_${userId}`, async () => {
      
        // Try cache first
        if (useCache) {
          const cached = await this.cache.get(cacheKey);
          if (cached) {
            this.stats.hits++;
            console.log('🚀 Cache HIT for recent prices:', cacheKey);
            // Handle both string and object formats from Redis
            const parsedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
            return { data: parsedData, error: null, source: 'cache' };
          }
        }

        this.stats.misses++;
        console.log('💿 Cache MISS, fetching recent prices from Supabase...');

        // Fetch from Supabase
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
        .eq('date', date)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

        if (error) throw error;

        // Cache the results with adaptive TTL
        if (data) {
          const adaptiveTTL = this.getAdaptiveTTL('recent_prices', { date });
          await this.cache.set(cacheKey, data, adaptiveTTL);
        }

        return { data, error: null, source: 'supabase' };
      });
    } catch (error) {
      this.stats.errors++;
      console.error('Error fetching recent prices:', error);
      return { data: null, error };
    }
  }

  // ================================
  // CACHE INVALIDATION
  // ================================

  // Invalidate related caches when data changes
  async invalidateRelatedCaches(priceRecord) {
    try {
      const { date, user_id, group_ids } = priceRecord;
      const patterns = [
        `cacique:recent_prices:${date}:${user_id}`,
        `cacique:daily_prices:${date}:${user_id}:*`,
      ];

      // Add group-specific patterns
      if (group_ids) {
        for (const groupId of group_ids) {
          patterns.push(`cacique:*:${date}:${user_id}:group_${groupId}:*`);
        }
      }

      const deletePromises = patterns.map(pattern => this.cache.clearCache(pattern));
      await Promise.all(deletePromises);

      console.log('🗑️ Cache invalidated for patterns:', patterns);
      return true;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return false;
    }
  }

  // Manual cache clearing (for maintenance)
  async clearAllPriceCaches() {
    try {
      await this.cache.clearCache('cacique:*');
      console.log('🗑️ All price caches cleared');
      return true;
    } catch (error) {
      console.error('Error clearing all caches:', error);
      return false;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  // Check if Redis is available
  async isRedisAvailable() {
    try {
      await this.cache.redis.ping();
      return true;
    } catch (error) {
      console.warn('Redis not available, falling back to Supabase only');
      return false;
    }
  }

  // Get adaptive TTL based on data patterns
  getAdaptiveTTL(dataType, data) {
    const now = new Date();
    const dataDate = new Date(data.date || data.created_at);
    const ageInHours = (now - dataDate) / (1000 * 60 * 60);
    
    switch (dataType) {
      case 'daily_prices':
        // Dados mais recentes ficam mais tempo no cache
        if (ageInHours < 24) return CACHE_TTL.SAVED_PRICES * 2; // 2 horas
        if (ageInHours < 168) return CACHE_TTL.SAVED_PRICES; // 1 hora
        return CACHE_TTL.SAVED_PRICES / 2; // 30 min para dados antigos
        
      case 'station_prices':
        return ageInHours < 24 ? CACHE_TTL.SAVED_PRICES : CACHE_TTL.SAVED_PRICES / 2;
        
      default:
        return CACHE_TTL.SAVED_PRICES;
    }
  }
  
  // Batch cache operations for better performance
  async batchCacheOperations(operations) {
    return this.batcher.add(async () => {
      const results = await Promise.allSettled(operations);
      return results.map(result => 
        result.status === 'fulfilled' ? result.value : { error: result.reason }
      );
    });
  }
  
  // Get enhanced cache statistics
  async getCacheStats() {
    try {
      const keys = await this.cache.redis.keys('cacique:*');
      const memoryUsage = await this.cache.redis.info('memory');
      
      const stats = {
        ...this.stats,
        totalKeys: keys.length,
        dailyPricesKeys: keys.filter(k => k.includes('daily_prices')).length,
        stationPricesKeys: keys.filter(k => k.includes('station_prices')).length,
        recentPricesKeys: keys.filter(k => k.includes('recent_prices')).length,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        memoryUsage: memoryUsage,
        lastUpdated: new Date().toISOString()
      };
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        ...this.stats,
        error: error.message
      };
    }
  }
  
  // Reset statistics
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      errors: 0
    };
  }
}

// Export singleton instance
export const priceCacheService = new PriceCacheService();
