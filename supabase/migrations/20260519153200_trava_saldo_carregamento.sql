ALTER TABLE public.pedidos_venda_itens
  ADD COLUMN IF NOT EXISTS saldo_disponivel NUMERIC(12,3) NOT NULL DEFAULT 0;

UPDATE public.pedidos_venda_itens
SET saldo_disponivel = COALESCE(NULLIF(saldo_disponivel, 0), quantidade_ton)
WHERE quantidade_ton IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validar_saldo_carregamento_item()
RETURNS TRIGGER AS $$
DECLARE
  saldo_atual NUMERIC;
BEGIN
  IF NEW.pedido_venda_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT saldo_disponivel
    INTO saldo_atual
  FROM public.pedidos_venda_itens
  WHERE id = NEW.pedido_venda_item_id
  FOR UPDATE;

  IF NEW.quantidade_ton > COALESCE(saldo_atual, 0) THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: % ton, solicitado: % ton',
      saldo_atual, NEW.quantidade_ton
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_saldo_carregamento_item ON public.carregamento_itens;
CREATE TRIGGER trg_validar_saldo_carregamento_item
  BEFORE INSERT OR UPDATE ON public.carregamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_saldo_carregamento_item();

CREATE OR REPLACE FUNCTION public.trg_reservar_saldo_pedido_item()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pedido_venda_item_id IS NOT NULL THEN
      UPDATE public.pedidos_venda_itens
      SET saldo_disponivel = saldo_disponivel - NEW.quantidade_ton
      WHERE id = NEW.pedido_venda_item_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO v_status FROM public.carregamentos WHERE id = OLD.carregamento_id;
    IF OLD.pedido_venda_item_id IS NOT NULL AND v_status = 'aguardando_liberacao' THEN
      UPDATE public.pedidos_venda_itens
      SET saldo_disponivel = saldo_disponivel + OLD.quantidade_ton
      WHERE id = OLD.pedido_venda_item_id;
    END IF;
    IF NEW.pedido_venda_item_id IS NOT NULL THEN
      UPDATE public.pedidos_venda_itens
      SET saldo_disponivel = saldo_disponivel - NEW.quantidade_ton
      WHERE id = NEW.pedido_venda_item_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.carregamentos WHERE id = OLD.carregamento_id;
    IF OLD.pedido_venda_item_id IS NOT NULL AND v_status = 'aguardando_liberacao' THEN
      UPDATE public.pedidos_venda_itens
      SET saldo_disponivel = saldo_disponivel + OLD.quantidade_ton
      WHERE id = OLD.pedido_venda_item_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservar_saldo_pedido_item ON public.carregamento_itens;
CREATE TRIGGER trg_reservar_saldo_pedido_item
  AFTER INSERT OR UPDATE OR DELETE ON public.carregamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_reservar_saldo_pedido_item();

NOTIFY pgrst, 'reload schema';
