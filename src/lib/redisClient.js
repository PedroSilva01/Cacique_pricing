import { Redis } from '@upstash/redis';

// Initialize Redis client with environment variables
const redis = new Redis({
  url: import.meta.env.VITE_UPSTASH_REDIS_REST_URL || 'https://equal-cat-8480.upstash.io',
  token: import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || 'ASEgAAImcDJjMTdiNDEzMGZmNGY0MWY0YTcwOTIwMmQzODdhZmQ3M3AyODQ4MA',
});

// Cache keys constants
export const CACHE_KEYS = {
  // Preços (dados dinâmicos)
  DAILY_PRICES: 'cacique:daily_prices',
  STATION_PRICES: 'cacique:station_prices', 
  RECENT_PRICES: 'cacique:recent_prices',
  USER_PRICES: (userId) => `cacique:user_prices:${userId}`,
  GROUP_PRICES: (groupId) => `cacique:group_prices:${groupId}`,
  
  // Configurações (dados semi-estáticos)
  USER_SETTINGS: (userId) => `cacique:user_settings:${userId}`,
  GROUPS: (userId) => `cacique:groups:${userId}`,
  POSTOS: (userId) => `cacique:postos:${userId}`,
  SUPPLIERS: (userId) => `cacique:suppliers:${userId}`,
  BASE_CITIES: (userId) => `cacique:base_cities:${userId}`,
  
  // Fretes (dados fixos)
  FREIGHT_ROUTES: (userId) => `cacique:freight_routes:${userId}`,
  
  // Pedidos (dados históricos para cálculos)
  PURCHASE_ORDERS: (userId) => `cacique:purchase_orders:${userId}`,
  USER_ORDERS: (userId) => `cacique:user_orders:${userId}`
};

// Cache expiration times (in seconds)
export const CACHE_TTL = {
  // Preços (dados dinâmicos - TTL menor)
  DAILY_PRICES: 3600, // 1 hour
  STATION_PRICES: 1800, // 30 minutes
  RECENT_PRICES: 7200, // 2 hours
  PRICE_GROUPS: 1800, // 30 minutes
  PRICE_HISTORY: 7200, // 2 hours
  USER_DATA: 1800, // 30 minutes
  
  // Configurações (dados semi-estáticos - TTL maior)
  SETTINGS: 14400, // 4 hours
  GROUPS: 7200, // 2 hours
  POSTOS: 7200, // 2 hours 
  SUPPLIERS: 14400, // 4 hours
  BASE_CITIES: 21600, // 6 hours
  
  // Fretes (dados fixos - TTL muito alto)
  FREIGHT_ROUTES: 86400, // 24 hours
  
  // Pedidos (dados históricos - TTL médio)
  PURCHASE_ORDERS: 10800, // 3 hours
  USER_ORDERS: 7200, // 2 hours
};

// Redis operations wrapper with error handling
export class CaciquePriceCache {
  constructor() {
    this.redis = redis;
  }

  async get(key) {
    try {
      const result = await this.redis.get(key);
      return result;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      // Garantir que TTL seja um número válido
      const validTTL = ttl && typeof ttl === 'number' ? ttl : 3600;
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, validTTL, serializedValue);
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  // Clear all cache patterns (for debugging/maintenance)
  async clearCache(pattern = 'cacique:*') {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Redis CLEAR error:', error);
      return false;
    }
  }

  // Specific methods for price operations
  async getSavedPrices(userId) {
    const key = CACHE_KEYS.USER_PRICES(userId);
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setSavedPrices(userId, prices) {
    const key = CACHE_KEYS.USER_PRICES(userId);
    return await this.set(key, prices, CACHE_TTL.USER_DATA);
  }

  async invalidateUserPrices(userId) {
    const key = CACHE_KEYS.USER_PRICES(userId);
    return await this.del(key);
  }

  async getGroupPrices(groupId) {
    const key = CACHE_KEYS.GROUP_PRICES(groupId);
    const cached = await this.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setGroupPrices(groupId, prices) {
    const key = CACHE_KEYS.GROUP_PRICES(groupId);
    return await this.set(key, prices, CACHE_TTL.PRICE_GROUPS);
  }

  async invalidateGroupPrices(groupId) {
    const key = CACHE_KEYS.GROUP_PRICES(groupId);
    return await this.del(key);
  }

  // Batch invalidation for updates
  async invalidateAllUserData(userId) {
    const userKey = CACHE_KEYS.USER_PRICES(userId);
    const generalKey = CACHE_KEYS.SAVED_PRICES;
    return Promise.all([
      this.del(userKey),
      this.del(generalKey)
    ]);
  }
}

// Export singleton instance
export const priceCache = new CaciquePriceCache();

export default redis;
