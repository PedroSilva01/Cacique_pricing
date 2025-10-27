-- Add is_base to cities to mark Base (fornecedor) cities
ALTER TABLE public.cities
ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_cities_is_base ON public.cities(is_base);
