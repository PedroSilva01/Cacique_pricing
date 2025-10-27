-- Adicionar campos para multi-seleção de postos e grupos em daily_prices

-- Adicionar coluna base_city_id (cidade base de origem do preço)
ALTER TABLE public.daily_prices
ADD COLUMN IF NOT EXISTS base_city_id UUID REFERENCES public.base_cities(id) ON DELETE SET NULL;

-- Adicionar array de group_ids (grupos específicos onde aplicar o preço)
ALTER TABLE public.daily_prices
ADD COLUMN IF NOT EXISTS group_ids UUID[] DEFAULT NULL;

-- Índices para performance em queries de busca de preços
CREATE INDEX IF NOT EXISTS idx_daily_prices_base_city_id ON public.daily_prices(base_city_id);
CREATE INDEX IF NOT EXISTS idx_daily_prices_group_ids ON public.daily_prices USING GIN (group_ids);

-- Comentários
COMMENT ON COLUMN public.daily_prices.base_city_id IS 'Cidade base (fornecedor) de onde vem este preço';
COMMENT ON COLUMN public.daily_prices.group_ids IS 'Array de UUIDs de grupos onde este preço se aplica (automaticamente aplicado a TODOS os postos do grupo)';
