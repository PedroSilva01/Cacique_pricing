-- Adicionar base de carregamento e postos aos grupos

-- Adicionar coluna base_city_id (base de carregamento do grupo)
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS base_city_id UUID REFERENCES public.base_cities(id) ON DELETE SET NULL;

-- Adicionar array de posto_ids (postos que fazem parte deste grupo)
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS posto_ids UUID[] DEFAULT NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_groups_base_city_id ON public.groups(base_city_id);
CREATE INDEX IF NOT EXISTS idx_groups_posto_ids ON public.groups USING GIN (posto_ids);

-- Comentários
COMMENT ON COLUMN public.groups.base_city_id IS 'Base de carregamento (cidade origem) para este grupo';
COMMENT ON COLUMN public.groups.posto_ids IS 'Array de UUIDs dos postos que pertencem a este grupo. Um posto pode estar em múltiplos grupos desde que sejam de bases diferentes';

-- Nota: A relação posto → grupo também existe via postos.group_ids
-- Agora temos relação bidirecional para facilitar queries
