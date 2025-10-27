-- Migração: Adicionar campo "bandeira" em postos e grupos
-- Data: 27/10/2025
-- Objetivo: Implementar regra de negócio de bandeiras (Ipiranga, Shell, Vibra, Bandeira Branca)

-- 1. Adicionar coluna "bandeira" na tabela "postos"
ALTER TABLE postos 
ADD COLUMN IF NOT EXISTS bandeira TEXT DEFAULT 'bandeira_branca';

-- 2. Adicionar coluna "bandeira" na tabela "groups"
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS bandeira TEXT DEFAULT 'bandeira_branca';

-- 3. Adicionar comentários
COMMENT ON COLUMN postos.bandeira IS 'Bandeira do posto: ipiranga, shell, vibra, bandeira_branca';
COMMENT ON COLUMN groups.bandeira IS 'Bandeira do grupo: ipiranga, shell, vibra, bandeira_branca';

-- 4. Adicionar coluna "bandeira" na tabela "suppliers" (para facilitar comparação)
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS bandeira TEXT DEFAULT 'bandeira_branca';

COMMENT ON COLUMN suppliers.bandeira IS 'Bandeira do fornecedor: ipiranga, shell, vibra, federal, bandeira_branca';

-- 5. Atualizar postos existentes (exemplo - ajustar conforme necessário)
-- UPDATE postos SET bandeira = 'ipiranga' WHERE name ILIKE '%cacique 11%';
-- UPDATE postos SET bandeira = 'vibra' WHERE name ILIKE '%cacique 15%';
-- UPDATE postos SET bandeira = 'bandeira_branca' WHERE name ILIKE '%cacique 25%';

-- 6. Atualizar suppliers existentes (exemplo - ajustar conforme necessário)
-- UPDATE suppliers SET bandeira = 'ipiranga' WHERE name ILIKE '%ipiranga%';
-- UPDATE suppliers SET bandeira = 'shell' WHERE name ILIKE '%shell%';
-- UPDATE suppliers SET bandeira = 'vibra' WHERE name ILIKE '%vibra%';
-- UPDATE suppliers SET bandeira = 'federal' WHERE name ILIKE '%federal%';

COMMIT;
