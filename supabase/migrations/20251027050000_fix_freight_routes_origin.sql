-- Corrigir foreign key de freight_routes.origin_city_id para apontar para base_cities

-- 1. Remover constraint antiga
ALTER TABLE public.freight_routes
DROP CONSTRAINT IF EXISTS freight_routes_origin_city_id_fkey;

-- 2. Adicionar constraint correta apontando para base_cities
ALTER TABLE public.freight_routes
ADD CONSTRAINT freight_routes_origin_city_id_fkey 
FOREIGN KEY (origin_city_id) REFERENCES public.base_cities(id) ON DELETE CASCADE;

-- 3. Comentário explicativo
COMMENT ON COLUMN public.freight_routes.origin_city_id IS 'ID da cidade base (fornecedor) de origem - referencia base_cities';
COMMENT ON COLUMN public.freight_routes.destination_city_id IS 'ID da cidade de destino (posto) - referencia cities';

-- ============================================
-- EXPLICAÇÃO:
-- ============================================
-- freight_routes tem 2 colunas:
-- 
-- origin_city_id → base_cities (Teresina, Fortaleza, São Luís)
--   Cidade BASE de onde sai o combustível
--
-- destination_city_id → cities (Imperatriz, Caxias, Bacabal)
--   Cidade DESTINO onde fica o posto
-- ============================================
