import DOMPurify from 'isomorphic-dompurify';

// ================================
// XSS PROTECTION UTILITIES
// ================================

/**
 * Sanitiza input de texto para prevenir XSS
 * @param {string} input - Input do usuário
 * @returns {string} - Input sanitizado
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove scripts e tags perigosas
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Remove todas as tags HTML
    ALLOWED_ATTR: [] // Remove todos os atributos
  });
  
  return sanitized.trim();
};

/**
 * Sanitiza HTML permitindo apenas tags seguras
 * @param {string} html - HTML para sanitizar
 * @returns {string} - HTML sanitizado
 */
export const sanitizeHTML = (html) => {
  if (typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br'],
    ALLOWED_ATTR: ['class']
  });
};

/**
 * Valida e sanitiza números decimais
 * @param {any} value - Valor para validar
 * @param {number} min - Valor mínimo (opcional)
 * @param {number} max - Valor máximo (opcional)
 * @returns {number|null} - Número válido ou null
 */
export const sanitizeNumber = (value, min = null, max = null) => {
  // Converter para string primeiro para manipulação
  const stringValue = String(value).replace(',', '.');
  const parsed = parseFloat(stringValue);
  
  if (isNaN(parsed)) return null;
  
  // Verificar limites
  if (min !== null && parsed < min) return null;
  if (max !== null && parsed > max) return null;
  
  return parsed;
};

/**
 * Valida formato de data
 * @param {string} date - Data no formato YYYY-MM-DD
 * @returns {boolean} - Se a data é válida
 */
export const validateDate = (date) => {
  if (typeof date !== 'string') return false;
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const dateObj = new Date(date + 'T00:00:00');
  return !isNaN(dateObj.getTime());
};

/**
 * Valida UUID
 * @param {string} uuid - UUID para validar
 * @returns {boolean} - Se o UUID é válido
 */
export const validateUUID = (uuid) => {
  if (typeof uuid !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// ================================
// RATE LIMITING
// ================================

class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  /**
   * Verifica se operação está dentro do limite
   * @param {string} key - Chave única (ex: userId + action)
   * @param {number} maxRequests - Máximo de requisições
   * @param {number} windowMs - Janela de tempo em ms
   * @returns {boolean} - Se permitido
   */
  checkLimit(key, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const requests = this.requests.get(key);
    
    // Remove requisições antigas
    const validRequests = requests.filter(time => now - time < windowMs);
    this.requests.set(key, validRequests);
    
    // Verifica limite
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Adiciona nova requisição
    validRequests.push(now);
    return true;
  }

  /**
   * Limpa registros antigos (executar periodicamente)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutos
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < maxAge);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Cleanup automático a cada 5 minutos
setInterval(() => {
  rateLimiter.cleanup();
}, 300000);

// ================================
// VALIDAÇÕES ESPECÍFICAS DA APLICAÇÃO
// ================================

/**
 * Valida dados de preços
 * @param {Object} priceData - Dados de preço
 * @returns {Object} - Resultado da validação
 */
export const validatePriceData = (priceData) => {
  const errors = [];
  const sanitized = {};
  
  // Validar user_id
  if (!validateUUID(priceData.user_id)) {
    errors.push('ID de usuário inválido');
  } else {
    sanitized.user_id = priceData.user_id;
  }
  
  // Validar data
  if (!validateDate(priceData.date)) {
    errors.push('Data inválida');
  } else {
    sanitized.date = priceData.date;
  }
  
  // Validar preços
  if (priceData.prices && typeof priceData.prices === 'object') {
    sanitized.prices = {};
    for (const [fuel, price] of Object.entries(priceData.prices)) {
      const sanitizedFuel = sanitizeText(fuel);
      const sanitizedPrice = sanitizeNumber(price, 0, 50); // Máximo R$ 50/L
      
      if (sanitizedFuel && sanitizedPrice !== null) {
        sanitized.prices[sanitizedFuel] = sanitizedPrice;
      } else {
        errors.push(`Preço inválido para ${fuel}`);
      }
    }
  }
  
  // Validar IDs de grupo (arrays de UUIDs)
  if (priceData.group_ids && Array.isArray(priceData.group_ids)) {
    sanitized.group_ids = priceData.group_ids.filter(id => validateUUID(id));
    if (sanitized.group_ids.length !== priceData.group_ids.length) {
      errors.push('Alguns IDs de grupo são inválidos');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Valida dados de busca/filtro
 * @param {Object} searchData - Dados de busca
 * @returns {Object} - Dados sanitizados
 */
export const validateSearchData = (searchData) => {
  const sanitized = {};
  
  // Sanitizar termo de busca
  if (searchData.search) {
    sanitized.search = sanitizeText(searchData.search).substring(0, 100);
  }
  
  // Validar data de filtro
  if (searchData.date && validateDate(searchData.date)) {
    sanitized.date = searchData.date;
  }
  
  // Validar IDs
  if (searchData.userId && validateUUID(searchData.userId)) {
    sanitized.userId = searchData.userId;
  }
  
  if (searchData.groupId && validateUUID(searchData.groupId)) {
    sanitized.groupId = searchData.groupId;
  }
  
  if (searchData.supplierId && validateUUID(searchData.supplierId)) {
    sanitized.supplierId = searchData.supplierId;
  }
  
  return sanitized;
};

// ================================
// VALIDAÇÃO DE ENTRADA DE FORMULÁRIO
// ================================

/**
 * Hook para validação de input em tempo real
 * @param {string} value - Valor do input
 * @param {string} type - Tipo de validação
 * @returns {Object} - Estado de validação
 */
export const useInputValidation = (value, type) => {
  const result = {
    isValid: true,
    error: null,
    sanitized: value
  };
  
  switch (type) {
    case 'price':
      const price = sanitizeNumber(value, 0, 50);
      if (price === null && value !== '') {
        result.isValid = false;
        result.error = 'Preço deve ser um número válido entre R$ 0 e R$ 50';
      } else {
        result.sanitized = price;
      }
      break;
      
    case 'text':
      result.sanitized = sanitizeText(value);
      if (result.sanitized.length > 255) {
        result.isValid = false;
        result.error = 'Texto muito longo (máximo 255 caracteres)';
      }
      break;
      
    case 'search':
      result.sanitized = sanitizeText(value).substring(0, 100);
      break;
      
    case 'date':
      if (value && !validateDate(value)) {
        result.isValid = false;
        result.error = 'Data inválida';
      }
      break;
      
    default:
      result.sanitized = sanitizeText(value);
  }
  
  return result;
};

// ================================
// PROTEÇÃO CONTRA INJECTION
// ================================

/**
 * Sanitiza parâmetros para queries do Supabase
 * @param {Object} params - Parâmetros da query
 * @returns {Object} - Parâmetros sanitizados
 */
export const sanitizeQueryParams = (params) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(params)) {
    const sanitizedKey = sanitizeText(key);
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeText(value);
    } else if (typeof value === 'number') {
      sanitized[sanitizedKey] = value;
    } else if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    }
  }
  
  return sanitized;
};

// ================================
// CONSTANTES DE SEGURANÇA
// ================================

export const SECURITY_LIMITS = {
  MAX_PRICE_VALUE: 50, // R$ 50/L máximo
  MAX_TEXT_LENGTH: 255,
  MAX_SEARCH_LENGTH: 100,
  
  // Rate limits
  PRICE_SAVE_LIMIT: 10, // 10 saves per minute
  SEARCH_LIMIT: 60, // 60 searches per minute
  API_LIMIT: 100, // 100 requests per minute
  
  // Time windows (ms)
  RATE_LIMIT_WINDOW: 60000, // 1 minute
};

export default {
  sanitizeText,
  sanitizeHTML,
  sanitizeNumber,
  validateDate,
  validateUUID,
  rateLimiter,
  validatePriceData,
  validateSearchData,
  useInputValidation,
  sanitizeQueryParams,
  SECURITY_LIMITS
};
