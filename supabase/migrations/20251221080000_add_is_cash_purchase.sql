-- Adicionar campo is_cash_purchase aos pedidos
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS is_cash_purchase BOOLEAN DEFAULT false;

-- Comentário
COMMENT ON COLUMN public.purchase_orders.is_cash_purchase IS 'Indica se a compra foi à vista (prazo = 0 dias)';

-- Atualizar registros existentes: prazo 0 = à vista
UPDATE public.purchase_orders 
SET is_cash_purchase = true
WHERE payment_term_days = 0;
