-- Adicionar campo fuel_types aos postos (array de strings)
ALTER TABLE public.postos 
ADD COLUMN IF NOT EXISTS fuel_types TEXT[];

-- Comentário
COMMENT ON COLUMN public.postos.fuel_types IS 'Array com os tipos de combustíveis que o posto vende (chaves de settings.fuelTypes)';

-- Valor padrão: todos os combustíveis se não especificado
UPDATE public.postos 
SET fuel_types = ARRAY['gasolina_comum', 'gasolina_aditivada', 'etanol', 'diesel_s10', 'diesel_comum']
WHERE fuel_types IS NULL;
