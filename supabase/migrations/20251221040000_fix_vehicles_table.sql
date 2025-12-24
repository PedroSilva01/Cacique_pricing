-- Remover campo freight_rates da tabela vehicles (usaremos freight_routes existente)
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS freight_rates;

-- Adicionar comentário explicativo
COMMENT ON TABLE public.vehicles IS 'Cadastro de veículos de entrega (fretes são gerenciados via freight_routes)';
