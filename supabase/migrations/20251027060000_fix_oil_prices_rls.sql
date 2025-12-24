-- Corrigir políticas RLS para oil_prices
-- Permitir inserção e atualização de preços de petróleo

-- 1. Verificar se a tabela existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'oil_prices') THEN
        -- Criar tabela se não existir
        CREATE TABLE public.oil_prices (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            date DATE NOT NULL UNIQUE,
            wti_price DECIMAL(10, 4),
            brent_price DECIMAL(10, 4),
            wti_change TEXT,
            brent_change TEXT,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 2. Habilitar RLS
ALTER TABLE public.oil_prices ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas
DROP POLICY IF EXISTS "Anyone can read oil prices" ON public.oil_prices;
DROP POLICY IF EXISTS "Service role can insert oil prices" ON public.oil_prices;
DROP POLICY IF EXISTS "Service role can update oil prices" ON public.oil_prices;
DROP POLICY IF EXISTS "Authenticated users can upsert oil prices" ON public.oil_prices;

-- 4. Criar políticas novas (idempotentes)

-- Permitir leitura pública (qualquer pessoa pode ver preços)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'oil_prices'
          AND policyname = 'Anyone can read oil prices'
    ) THEN
        CREATE POLICY "Anyone can read oil prices"
        ON public.oil_prices
        FOR SELECT
        USING (true);
    END IF;
END $$;

-- Permitir inserção para usuários autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'oil_prices'
          AND policyname = 'Authenticated users can insert oil prices'
    ) THEN
        CREATE POLICY "Authenticated users can insert oil prices"
        ON public.oil_prices
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;
END $$;

-- Permitir atualização para usuários autenticados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'oil_prices'
          AND policyname = 'Authenticated users can update oil prices'
    ) THEN
        CREATE POLICY "Authenticated users can update oil prices"
        ON public.oil_prices
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 5. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_oil_prices_date ON public.oil_prices(date DESC);
CREATE INDEX IF NOT EXISTS idx_oil_prices_timestamp ON public.oil_prices(timestamp DESC);

-- 6. Comentários
COMMENT ON TABLE public.oil_prices IS 'Preços históricos do petróleo (WTI e BRENT)';
COMMENT ON COLUMN public.oil_prices.date IS 'Data do preço (YYYY-MM-DD)';
COMMENT ON COLUMN public.oil_prices.wti_price IS 'Preço WTI em USD por barril';
COMMENT ON COLUMN public.oil_prices.brent_price IS 'Preço BRENT em USD por barril';
COMMENT ON COLUMN public.oil_prices.wti_change IS 'Variação percentual do WTI';
COMMENT ON COLUMN public.oil_prices.brent_change IS 'Variação percentual do BRENT';
COMMENT ON COLUMN public.oil_prices.timestamp IS 'Momento da última atualização';
