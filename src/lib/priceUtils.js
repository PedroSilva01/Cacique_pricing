/**
 * Utilities para lidar com preços mantidos (out of stock / não enviados)
 */

/**
 * Verifica se um preço específico é mantido (não atual)
 * @param {Object} priceRecord - Registro de daily_prices
 * @param {string} fuelKey - Chave do combustível (ex: 'diesel_s10')
 * @returns {Object|null} { isMaintained: boolean, originalDate: string } ou null
 */
export const isPriceMaintained = (priceRecord, fuelKey) => {
  if (!priceRecord?.maintained_prices) return { isMaintained: false };
  
  const originalDate = priceRecord.maintained_prices[fuelKey];
  return {
    isMaintained: !!originalDate,
    originalDate: originalDate || null,
    daysSinceMaintained: originalDate ? 
      Math.floor((new Date(priceRecord.date) - new Date(originalDate)) / (1000 * 60 * 60 * 24)) : 0
  };
};

/**
 * Filtra preços mantidos de um dataset para análises diárias
 * (Remove preços mantidos, mantém apenas fresh prices)
 * @param {Array} priceRecords - Array de registros de daily_prices
 * @param {string} fuelKey - Chave do combustível a filtrar (opcional)
 * @returns {Array} Registros filtrados apenas com preços atuais
 */
export const filterFreshPrices = (priceRecords, fuelKey = null) => {
  return priceRecords.filter(record => {
    if (!record.maintained_prices || Object.keys(record.maintained_prices).length === 0) {
      return true; // Todos os preços são fresh
    }
    
    if (fuelKey) {
      // Se especificou um combustível, verificar apenas esse
      return !record.maintained_prices[fuelKey];
    }
    
    // Se não especificou, manter apenas se NENHUM preço for mantido
    return Object.keys(record.prices || {}).every(key => !record.maintained_prices[key]);
  });
};

/**
 * Componente React para exibir badge de preço mantido
 * Uso: <MaintainedPriceBadge maintained={isPriceMaintained(record, fuelKey)} />
 */
export const MaintainedPriceBadge = ({ maintained, variant = 'default' }) => {
  if (!maintained?.isMaintained) return null;
  
  const date = new Date(maintained.originalDate);
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  
  if (variant === 'detailed') {
    // Para dashboards detalhados - vermelho com alerta
    return (
      <span 
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-md"
        title={`Produto sem estoque desde ${formattedDate}. Preço mantido há ${maintained.daysSinceMaintained} dia(s).`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Sem estoque
      </span>
    );
  }
  
  // Variant 'default' - para análises simples, não mostra nada
  return null;
};

/**
 * Formata o valor do preço com indicação visual se mantido
 * @param {number} price - Preço a formatar
 * @param {Object} maintained - Resultado de isPriceMaintained
 * @param {string} variant - 'simple' ou 'detailed'
 * @returns {Object} { value, className, tooltip }
 */
export const formatPriceWithStatus = (price, maintained, variant = 'simple') => {
  const baseFormat = price.toFixed(4);
  
  if (!maintained?.isMaintained || variant === 'simple') {
    return {
      value: `R$ ${baseFormat}`,
      className: '',
      tooltip: null
    };
  }
  
  // Variant detailed - preço em vermelho com indicação
  return {
    value: `R$ ${baseFormat}`,
    className: 'text-red-600 dark:text-red-400 font-bold',
    tooltip: `⚠️ Sem estoque desde ${new Date(maintained.originalDate).toLocaleDateString('pt-BR')}. Preço mantido há ${maintained.daysSinceMaintained} dia(s).`
  };
};

/**
 * Hook React para usar preços com status de manutenção
 */
export const useMaintainedPrices = (priceRecords) => {
  return priceRecords.map(record => ({
    ...record,
    _priceStatus: Object.keys(record.prices || {}).reduce((acc, fuelKey) => {
      acc[fuelKey] = isPriceMaintained(record, fuelKey);
      return acc;
    }, {})
  }));
};
