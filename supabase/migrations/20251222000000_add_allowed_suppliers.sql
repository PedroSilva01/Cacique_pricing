-- Adicionar campo allowed_suppliers nas tabelas groups e postos
-- NULL ou array vazio significa que pode comprar de qualquer fornecedor (bandeira branca)
-- Se especificado, apenas os fornecedores listados são permitidos

ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allowed_suppliers text[] DEFAULT NULL;

ALTER TABLE postos 
ADD COLUMN IF NOT EXISTS allowed_suppliers text[] DEFAULT NULL;

COMMENT ON COLUMN groups.allowed_suppliers IS 'IDs dos fornecedores permitidos para este grupo. NULL/vazio = permite todos (bandeira branca)';
COMMENT ON COLUMN postos.allowed_suppliers IS 'IDs dos fornecedores permitidos para este posto. NULL/vazio = permite todos (bandeira branca)';
