-- Adiciona coluna modo_calculo à tabela pricing_records
ALTER TABLE public.pricing_records
ADD COLUMN IF NOT EXISTS modo_calculo TEXT NOT NULL DEFAULT 'formulacao';

-- Adiciona constraint para garantir valores válidos
ALTER TABLE public.pricing_records
ADD CONSTRAINT pricing_records_modo_calculo_check
CHECK (modo_calculo IN ('formulacao', 'produtos_livres'));

-- Adiciona comentário explicativo
COMMENT ON COLUMN public.pricing_records.modo_calculo IS 'Modo de cálculo da precificação: formulacao (NPK) ou produtos_livres';
