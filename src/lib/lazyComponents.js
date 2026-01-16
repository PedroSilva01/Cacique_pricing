import { lazy, Suspense } from 'react';
import { RefreshCw } from 'lucide-react';

// ================================
// LAZY LOADING COMPONENTS
// ================================

/**
 * Componente de loading personalizado
 */
const LoadingSpinner = ({ message = "Carregando..." }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
    <p className="text-slate-600 dark:text-slate-400 font-medium">{message}</p>
  </div>
);

/**
 * HOC para componentes lazy com loading personalizado
 */
export const withLazyLoading = (importFn, loadingMessage) => {
  const LazyComponent = lazy(importFn);
  
  return (props) => (
    <Suspense fallback={<LoadingSpinner message={loadingMessage} />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

// ================================
// LAZY COMPONENTS DEFINITIONS
// ================================

// Páginas principais (carregamento otimizado)
export const LazyPriceEntry = withLazyLoading(
  () => import('@/pages/PriceEntry'),
  "Carregando entrada de preços..."
);

export const LazyGroupPrices = withLazyLoading(
  () => import('@/pages/GroupPrices'),
  "Carregando preços por grupo..."
);

export const LazyPriceEdit = withLazyLoading(
  () => import('@/pages/PriceEdit'),
  "Carregando edição de preços..."
);

export const LazyPurchaseOrders = withLazyLoading(
  () => import('@/pages/PurchaseOrders'),
  "Carregando pedidos de compra..."
);

export const LazyVolumeAnalytics = withLazyLoading(
  () => import('@/pages/VolumeAnalytics'),
  "Carregando análise de volumes..."
);

export const LazyFinancialDashboard = withLazyLoading(
  () => import('@/pages/FinancialDashboard'),
  "Carregando dashboard financeiro..."
);

export const LazySettingsPage = withLazyLoading(
  () => import('@/pages/SettingsPage'),
  "Carregando configurações..."
);

// Componentes pesados (charts, relatórios)
export const LazyAverageFuelPricesChart = withLazyLoading(
  () => import('@/components/AverageFuelPricesChart'),
  "Carregando gráfico de preços..."
);

export const LazyBestCostAnalysis = withLazyLoading(
  () => import('@/components/BestCostAnalysis'),
  "Carregando análise de custos..."
);

export const LazyCompetitivePricesChart = withLazyLoading(
  () => import('@/components/CompetitivePricesChart'),
  "Carregando análise competitiva..."
);

export const LazyVolumeChart = withLazyLoading(
  () => import('@/components/VolumeChart'),
  "Carregando gráfico de volumes..."
);

export const LazyProfitabilityChart = withLazyLoading(
  () => import('@/components/ProfitabilityChart'),
  "Carregando análise de lucratividade..."
);

// ================================
// PRELOADING UTILITIES
// ================================

/**
 * Preload de componentes críticos
 */
export const preloadCriticalComponents = async () => {
  try {
    // Precarregar componentes mais usados
    const preloadPromises = [
      import('@/pages/PriceEntry'),
      import('@/pages/GroupPrices'),
      import('@/components/AverageFuelPricesChart')
    ];
    
    await Promise.allSettled(preloadPromises);
    console.log('✅ Critical components preloaded');
  } catch (error) {
    console.warn('⚠️ Error preloading components:', error);
  }
};

/**
 * Preload baseado na navegação do usuário
 */
export const preloadOnHover = (componentImportFn) => {
  return {
    onMouseEnter: () => {
      componentImportFn().catch(() => {
        // Silently fail - component will load when actually needed
      });
    }
  };
};

/**
 * Preload condicional baseado no dispositivo
 */
export const conditionalPreload = async () => {
  // Não fazer preload em dispositivos com pouca memória
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    return;
  }
  
  // Não fazer preload em conexões lentas
  if (navigator.connection && navigator.connection.effectiveType === 'slow-2g') {
    return;
  }
  
  await preloadCriticalComponents();
};

// ================================
// CODE SPLITTING POR ROTA
// ================================

/**
 * Roteamento lazy com código dividido
 */
export const lazyRoutes = {
  '/': {
    component: LazyPriceEntry,
    preload: () => import('@/pages/PriceEntry')
  },
  '/group-prices': {
    component: LazyGroupPrices,
    preload: () => import('@/pages/GroupPrices')
  },
  '/price-edit': {
    component: LazyPriceEdit,
    preload: () => import('@/pages/PriceEdit')
  },
  '/purchase-orders': {
    component: LazyPurchaseOrders,
    preload: () => import('@/pages/PurchaseOrders')
  },
  '/analytics': {
    component: LazyVolumeAnalytics,
    preload: () => import('@/pages/VolumeAnalytics')
  },
  '/dashboard': {
    component: LazyFinancialDashboard,
    preload: () => import('@/pages/FinancialDashboard')
  },
  '/settings': {
    component: LazySettingsPage,
    preload: () => import('@/pages/SettingsPage')
  }
};

/**
 * Router Helper para preload automático
 */
export class LazyRouter {
  constructor() {
    this.preloadedRoutes = new Set();
  }
  
  preloadRoute(path) {
    if (this.preloadedRoutes.has(path) || !lazyRoutes[path]) {
      return;
    }
    
    this.preloadedRoutes.add(path);
    lazyRoutes[path].preload().catch(() => {
      this.preloadedRoutes.delete(path);
    });
  }
  
  preloadAdjacentRoutes(currentPath) {
    // Precarregar rotas relacionadas
    const adjacentRoutes = {
      '/': ['/group-prices', '/price-edit'],
      '/group-prices': ['/price-edit', '/purchase-orders'],
      '/price-edit': ['/group-prices'],
      '/purchase-orders': ['/analytics', '/dashboard'],
      '/analytics': ['/dashboard'],
      '/dashboard': ['/analytics'],
      '/settings': []
    };
    
    const adjacent = adjacentRoutes[currentPath] || [];
    adjacent.forEach(route => this.preloadRoute(route));
  }
}

export const lazyRouter = new LazyRouter();

// ================================
// BUNDLE OPTIMIZATION UTILITIES
// ================================

/**
 * Dynamic imports com cache
 */
const importCache = new Map();

export const cachedImport = async (importFn, key) => {
  if (importCache.has(key)) {
    return importCache.get(key);
  }
  
  const modulePromise = importFn();
  importCache.set(key, modulePromise);
  
  try {
    return await modulePromise;
  } catch (error) {
    importCache.delete(key);
    throw error;
  }
};

/**
 * Lazy loading de bibliotecas pesadas
 */
export const loadHeavyLibraries = {
  charts: () => cachedImport(() => import('recharts'), 'recharts'),
  excel: () => cachedImport(() => import('exceljs'), 'exceljs'),
  pdf: () => cachedImport(() => import('jspdf'), 'jspdf'),
  datetime: () => cachedImport(() => import('date-fns'), 'date-fns')
};

// ================================
// PERFORMANCE MONITORING
// ================================

/**
 * Monitoramento de performance de componentes lazy
 */
export const monitorLazyLoading = (componentName) => {
  return {
    onLoad: () => {
      console.log(`📦 ${componentName} loaded`);
      
      // Enviar métricas se disponível
      if (window.gtag) {
        window.gtag('event', 'lazy_component_load', {
          component_name: componentName,
          load_time: performance.now()
        });
      }
    },
    onError: (error) => {
      console.error(`❌ Failed to load ${componentName}:`, error);
      
      // Reportar erro se disponível
      if (window.gtag) {
        window.gtag('event', 'lazy_component_error', {
          component_name: componentName,
          error_message: error.message
        });
      }
    }
  };
};

export default {
  withLazyLoading,
  preloadCriticalComponents,
  conditionalPreload,
  lazyRouter,
  loadHeavyLibraries,
  cachedImport
};
