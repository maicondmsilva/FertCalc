-- Add new fields to pedidos_venda for PDF extraction improvements
ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS embalagem VARCHAR(100);
ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS tipo_frete VARCHAR(3) CHECK (tipo_frete IN ('CIF', 'FOB'));
ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(15,2);
