-- Remover tabela vehicles duplicada (sistema já usa vehicleTypes em user_settings)
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- O sistema já possui:
-- 1. vehicleTypes em user_settings.settings.vehicleTypes
-- 2. Custos de frete por tipo de veículo em freight_routes.costs
