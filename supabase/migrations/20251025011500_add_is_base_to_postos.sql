-- Add is_base flag to postos to differentiate base cities (fornecedores) from destination cities
ALTER TABLE public.postos
ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT false;

-- Optional: backfill existing data manually later with UPDATE statements

-- Index to speed up filtering
CREATE INDEX IF NOT EXISTS idx_postos_is_base ON public.postos(is_base);
