-- Criar tabela para limites de pagamento diários por dia da semana
-- Versão robusta com tratamento de erros

-- 1. Criar a tabela principal
CREATE TABLE IF NOT EXISTS public.daily_payment_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_date DATE NOT NULL, -- Data de início da semana (ex: 2026-01-05 para semana que começa na segunda)
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo, 1=segunda, ..., 6=sábado
    daily_limit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar constraint única para evitar duplicados (separado para melhor controle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'daily_payment_limits_user_week_day_key'
        AND table_name = 'daily_payment_limits'
        AND table_schema = 'public'
    ) THEN
        -- Remover constraint se existir com nome diferente
        ALTER TABLE public.daily_payment_limits 
        DROP CONSTRAINT IF EXISTS daily_payment_limits_user_week_day_key;
    END IF;
    
    -- Adicionar constraint única
    ALTER TABLE public.daily_payment_limits 
    ADD CONSTRAINT daily_payment_limits_user_week_day_key 
    UNIQUE (user_id, week_date, day_of_week);
END $$;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_payment_limits_user_week ON public.daily_payment_limits(user_id, week_date);
CREATE INDEX IF NOT EXISTS idx_daily_payment_limits_week_date ON public.daily_payment_limits(week_date);

-- 4. Adicionar comentários
COMMENT ON TABLE public.daily_payment_limits IS 'Limites de pagamento diários configurados por dia da semana';
COMMENT ON COLUMN public.daily_payment_limits.week_date IS 'Data de início da semana (segunda-feira)';
COMMENT ON COLUMN public.daily_payment_limits.day_of_week IS 'Dia da semana: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado';
COMMENT ON COLUMN public.daily_payment_limits.daily_limit IS 'Limite de pagamento para o dia específico';

-- 5. Trigger para atualizar updated_at (opcional, mas boa prática)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_payment_limits_updated_at 
    BEFORE UPDATE ON public.daily_payment_limits 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Verificação final
DO $$
BEGIN
    RAISE NOTICE 'Tabela daily_payment_limits criada com sucesso!';
    RAISE NOTICE 'Estrutura: id (UUID), user_id (UUID), week_date (DATE), day_of_week (INTEGER), daily_limit (DECIMAL)';
    RAISE NOTICE 'Constraints: daily_payment_limits_user_week_day_key (UNIQUE)';
    RAISE NOTICE 'Índices: idx_daily_payment_limits_user_week, idx_daily_payment_limits_week_date';
END $$;
