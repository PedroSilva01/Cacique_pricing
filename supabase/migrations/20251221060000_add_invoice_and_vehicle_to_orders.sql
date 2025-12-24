-- Adicionar campos de data de faturamento e tipo de veículo aos pedidos
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS invoice_date DATE,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- Comentários
COMMENT ON COLUMN public.purchase_orders.invoice_date IS 'Data de faturamento do pedido';
COMMENT ON COLUMN public.purchase_orders.vehicle_type IS 'Tipo de veículo usado (chave de settings.vehicleTypes)';
