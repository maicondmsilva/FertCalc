-- Adiciona coluna visivel_capa na tabela management_categorias
-- Default TRUE: todas as categorias aparecem na capa por padrão
ALTER TABLE management_categorias ADD COLUMN IF NOT EXISTS visivel_capa BOOLEAN DEFAULT TRUE;
UPDATE management_categorias SET visivel_capa = TRUE WHERE visivel_capa IS NULL;
