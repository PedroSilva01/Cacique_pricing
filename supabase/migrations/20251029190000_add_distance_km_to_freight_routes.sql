-- Adiciona coluna opcional de distância (km) para rotas de frete
ALTER TABLE public.freight_routes
ADD COLUMN IF NOT EXISTS distance_km NUMERIC;

COMMENT ON COLUMN public.freight_routes.distance_km IS 'Distância média em quilômetros entre a cidade base de origem e a cidade destino (opcional).';
