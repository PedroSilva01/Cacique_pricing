import debounce from 'lodash.debounce';

// ================================
// PERFORMANCE UTILITIES
// ================================

/**
 * Debounce personalizado para operações específicas
 */
export const createDebouncer = (func, delay = 300, options = {}) => {
  return debounce(func, delay, {
    leading: false,
    trailing: true,
    ...options
  });
};

/**
 * Debouncer para buscas
 */
export const debounceSearch = createDebouncer((callback) => callback(), 500);

/**
 * Debouncer para salvamento automático
 */
export const debounceAutoSave = createDebouncer((callback) => callback(), 2000);

/**
 * Debouncer para validação de entrada
 */
export const debounceValidation = createDebouncer((callback) => callback(), 300);

// ================================
// LAZY LOADING UTILITIES
// ================================

/**
 * Lazy load de imagens
 * @param {HTMLImageElement} img - Elemento de imagem
 * @param {string} src - URL da imagem
 */
export const lazyLoadImage = (img, src) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const image = entry.target;
        image.src = src;
        image.classList.add('loaded');
        observer.unobserve(image);
      }
    });
  });
  
  observer.observe(img);
};

/**
 * Virtual scrolling para listas grandes
 */
export class VirtualList {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleItems = new Map();
    this.startIndex = 0;
    this.endIndex = 0;
    
    this.init();
  }
  
  init() {
    this.container.style.position = 'relative';
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    this.updateVisibleItems();
  }
  
  setItems(items) {
    this.items = items;
    this.updateVisibleItems();
  }
  
  handleScroll() {
    this.updateVisibleItems();
  }
  
  updateVisibleItems() {
    const containerHeight = this.container.clientHeight;
    const scrollTop = this.container.scrollTop;
    
    this.startIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(containerHeight / this.itemHeight) + 2; // Buffer
    this.endIndex = Math.min(this.startIndex + visibleCount, this.items.length);
    
    // Limpar itens não visíveis
    this.visibleItems.forEach((element, index) => {
      if (index < this.startIndex || index >= this.endIndex) {
        element.remove();
        this.visibleItems.delete(index);
      }
    });
    
    // Adicionar novos itens visíveis
    for (let i = this.startIndex; i < this.endIndex; i++) {
      if (!this.visibleItems.has(i) && this.items[i]) {
        const element = this.renderItem(this.items[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.height = `${this.itemHeight}px`;
        
        this.container.appendChild(element);
        this.visibleItems.set(i, element);
      }
    }
    
    // Ajustar altura do container
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
  }
}

// ================================
// MEMOIZAÇÃO
// ================================

/**
 * Cache de resultados de função
 */
export class MemoizeCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (item) {
      // Move para o final (LRU)
      this.cache.delete(key);
      this.cache.set(key, item);
      return item.value;
    }
    return undefined;
  }
  
  set(key, value) {
    // Remove item mais antigo se necessário
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  clear() {
    this.cache.clear();
  }
  
  has(key) {
    return this.cache.has(key);
  }
}

/**
 * Memoização de funções
 * @param {Function} fn - Função para memoizar
 * @param {Function} keyGenerator - Gerador de chave (opcional)
 * @returns {Function} - Função memoizada
 */
export const memoize = (fn, keyGenerator = (...args) => JSON.stringify(args)) => {
  const cache = new MemoizeCache();
  
  return function memoized(...args) {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
};

// ================================
// OTIMIZAÇÃO DE RENDERIZAÇÃO
// ================================

/**
 * RequestAnimationFrame scheduler
 */
export class FrameScheduler {
  constructor() {
    this.tasks = [];
    this.isScheduled = false;
  }
  
  schedule(task, priority = 0) {
    this.tasks.push({ task, priority });
    this.tasks.sort((a, b) => b.priority - a.priority);
    
    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.processTasks());
    }
  }
  
  processTasks() {
    const startTime = performance.now();
    const maxTime = 16; // ~60fps
    
    while (this.tasks.length > 0 && (performance.now() - startTime) < maxTime) {
      const { task } = this.tasks.shift();
      task();
    }
    
    if (this.tasks.length > 0) {
      requestAnimationFrame(() => this.processTasks());
    } else {
      this.isScheduled = false;
    }
  }
}

export const frameScheduler = new FrameScheduler();

/**
 * Batching de DOM updates
 */
export class DOMBatcher {
  constructor() {
    this.readTasks = [];
    this.writeTasks = [];
    this.isScheduled = false;
  }
  
  read(task) {
    this.readTasks.push(task);
    this.schedule();
  }
  
  write(task) {
    this.writeTasks.push(task);
    this.schedule();
  }
  
  schedule() {
    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }
  
  flush() {
    // Executar todas as leituras primeiro
    while (this.readTasks.length > 0) {
      const task = this.readTasks.shift();
      task();
    }
    
    // Depois todas as escritas
    while (this.writeTasks.length > 0) {
      const task = this.writeTasks.shift();
      task();
    }
    
    this.isScheduled = false;
  }
}

export const domBatcher = new DOMBatcher();

// ================================
// OTIMIZAÇÃO DE NETWORK
// ================================

/**
 * Request deduplication
 */
export class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }
  
  async request(key, requestFn) {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const promise = requestFn()
      .finally(() => {
        this.pendingRequests.delete(key);
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const requestDeduplicator = new RequestDeduplicator();

/**
 * Batch multiple requests
 */
export class RequestBatcher {
  constructor(batchSize = 10, delayMs = 100) {
    this.batchSize = batchSize;
    this.delayMs = delayMs;
    this.queue = [];
    this.timeoutId = null;
  }
  
  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }
  
  async flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    const batch = this.queue.splice(0);
    if (batch.length === 0) return;
    
    try {
      const results = await Promise.allSettled(
        batch.map(({ request }) => request())
      );
      
      batch.forEach(({ resolve, reject }, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          resolve(result.value);
        } else {
          reject(result.reason);
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }
}

// ================================
// PERFORMANCE MONITORING
// ================================

/**
 * Performance metrics collector
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
    this.metrics.set(name, performance.now());
  }
  
  measure(startMark, endMark) {
    const startTime = this.metrics.get(startMark);
    const endTime = this.metrics.get(endMark);
    
    if (startTime && endTime) {
      const duration = endTime - startTime;
      
      if (performance.measure) {
        performance.measure(`${startMark}-${endMark}`, startMark, endMark);
      }
      
      return duration;
    }
    
    return null;
  }
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
  
  clear() {
    this.metrics.clear();
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ================================
// UTILITÁRIOS DE PERFORMANCE
// ================================

/**
 * Throttle para eventos de scroll/resize
 * @param {Function} func - Função para throttle
 * @param {number} limit - Limite em ms
 * @returns {Function} - Função throttled
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Detecta se o dispositivo tem performance limitada
 */
export const isLowEndDevice = () => {
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
    return true;
  }
  
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
    return true;
  }
  
  return false;
};

/**
 * Configuração adaptativa baseada no dispositivo
 */
export const getPerformanceConfig = () => {
  const isLowEnd = isLowEndDevice();
  
  return {
    animationReducedMotion: isLowEnd,
    enableVirtualScrolling: isLowEnd,
    reduceImageQuality: isLowEnd,
    batchSize: isLowEnd ? 5 : 10,
    debounceDelay: isLowEnd ? 500 : 300,
    maxCacheSize: isLowEnd ? 50 : 100
  };
};

export default {
  createDebouncer,
  debounceSearch,
  debounceAutoSave,
  debounceValidation,
  lazyLoadImage,
  VirtualList,
  MemoizeCache,
  memoize,
  FrameScheduler,
  frameScheduler,
  DOMBatcher,
  domBatcher,
  RequestDeduplicator,
  requestDeduplicator,
  RequestBatcher,
  PerformanceMonitor,
  performanceMonitor,
  throttle,
  isLowEndDevice,
  getPerformanceConfig
};
