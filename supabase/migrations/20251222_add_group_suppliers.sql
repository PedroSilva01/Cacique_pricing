-- Adicionar coluna para armazenar fornecedores permitidos por grupo
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS allowed_supplier_ids TEXT[] DEFAULT '{}';

-- Adicionar comentário explicativo
COMMENT ON COLUMN groups.allowed_supplier_ids IS 'Array de IDs de fornecedores que os postos deste grupo podem usar';

-- Criar índice para melhorar performance nas buscas
CREATE INDEX IF NOT EXISTS idx_groups_allowed_supplier_ids ON groups USING GIN (allowed_supplier_ids);

-- Atualizar grupos existentes para permitir todos os fornecedores (backward compatibility)
-- Os usuários podem então restringir conforme necessário
UPDATE groups 
SET allowed_supplier_ids = ARRAY(SELECT id::text FROM suppliers WHERE user_id = groups.user_id)
WHERE allowed_supplier_ids = '{}' OR allowed_supplier_ids IS NULL;
