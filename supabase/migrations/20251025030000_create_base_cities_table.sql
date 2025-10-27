-- Criar tabela separada para cidades bases (fornecedores)
CREATE TABLE IF NOT EXISTS public.base_cities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT base_cities_user_id_name_key UNIQUE (user_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_base_cities_user_id ON public.base_cities(user_id);
CREATE INDEX IF NOT EXISTS idx_base_cities_name ON public.base_cities(name);

-- RLS (Row Level Security)
ALTER TABLE public.base_cities ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own base cities" ON public.base_cities
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own base cities" ON public.base_cities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own base cities" ON public.base_cities
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own base cities" ON public.base_cities
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_base_cities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_base_cities_updated_at_trigger
    BEFORE UPDATE ON public.base_cities
    FOR EACH ROW
    EXECUTE FUNCTION update_base_cities_updated_at();

-- Comentários
COMMENT ON TABLE public.base_cities IS 'Cidades bases (fornecedores) - separadas das cidades de destino';
COMMENT ON COLUMN public.base_cities.name IS 'Nome da cidade base';
COMMENT ON COLUMN public.base_cities.user_id IS 'ID do usuário proprietário';
