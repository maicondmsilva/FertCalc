-- Permite salvar embalagem por item no pedido de venda
ALTER TABLE public.pedidos_venda_itens
  ADD COLUMN IF NOT EXISTS embalagem TEXT;

NOTIFY pgrst, 'reload schema';
