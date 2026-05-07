ALTER TABLE public.pedidos_venda
  ADD CONSTRAINT pedidos_venda_numero_emitente_unique
  UNIQUE (numero_pedido, emitente);
