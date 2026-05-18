-- ═══════════════════════════════════════════════════════════════════════════════
--  Migration: Fix Trigger Saldo Pedido - Considerar Liberação Parcial
--  Ajusta trigger para considerar quantidade_liberada em vez de quantidade_total
-- ═══════════════════════════════════════════════════════════════════════════════

-- Atualizar função do trigger para usar quantidade liberada quando disponível
CREATE OR REPLACE FUNCTION public.atualizar_saldo_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido_id UUID;
  v_quantidade_consumida NUMERIC(15,3);
BEGIN
  -- Determinar qual pedido_venda_id foi afetado
  IF TG_OP = 'DELETE' THEN
    v_pedido_id := OLD.pedido_venda_id;
  ELSE
    v_pedido_id := NEW.pedido_venda_id;
  END IF;

  -- Só atualizar se o carregamento está vinculado a um pedido
  IF v_pedido_id IS NOT NULL THEN
    -- Calcular quantidade consumida:
    -- Se status indica carregamento ativo/finalizado, usar quantidade_liberada
    -- Caso contrário, usar quantidade_total (reserva)
    SELECT COALESCE(SUM(
      CASE 
        WHEN status IN ('liberado_total', 'liberado_parcial', 'em_carregamento', 'carregado') 
        THEN COALESCE(quantidade_liberada, quantidade_total)
        WHEN status NOT IN ('cancelado')
        THEN quantidade_total
        ELSE 0
      END
    ), 0)
    INTO v_quantidade_consumida
    FROM public.carregamentos
    WHERE pedido_venda_id = v_pedido_id;

    -- Atualizar o pedido com a quantidade consumida
    UPDATE public.pedidos_venda
    SET quantidade_carregada = v_quantidade_consumida
    WHERE id = v_pedido_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger já existe, mas vamos garantir que está ativo
DROP TRIGGER IF EXISTS trg_saldo_pedido ON public.carregamentos;
CREATE TRIGGER trg_saldo_pedido
  AFTER INSERT OR UPDATE OR DELETE ON public.carregamentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_pedido();

NOTIFY pgrst, 'reload schema';
