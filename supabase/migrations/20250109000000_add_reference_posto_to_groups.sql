-- Adicionar campo de posto de referência aos grupos
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS reference_posto_id UUID REFERENCES public.postos(id) ON DELETE SET NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.groups.reference_posto_id IS 'Posto de referência para preços do grupo. Usado como base para cálculos e comparações.';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_groups_reference_posto_id ON public.groups(reference_posto_id);
