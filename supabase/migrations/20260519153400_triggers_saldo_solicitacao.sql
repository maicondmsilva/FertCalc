CREATE OR REPLACE FUNCTION public.calcular_saldo_solicitacao(p_carregamento_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  qtd_total NUMERIC;
  qtd_cancelada NUMERIC;
  qtd_reservada NUMERIC;
BEGIN
  SELECT quantidade_total, COALESCE(quantidade_cancelada, 0)
    INTO qtd_total, qtd_cancelada
  FROM public.carregamentos
  WHERE id = p_carregamento_id
  FOR UPDATE;

  SELECT COALESCE(SUM(
    CASE
      WHEN status = 'concluido' THEN COALESCE(quantidade_carregada, 0)
      WHEN status IN ('agendado', 'em_carregamento') THEN COALESCE(quantidade_agendada, 0)
      ELSE 0
    END
  ), 0)
  INTO qtd_reservada
  FROM public.carregamento_execucoes
  WHERE carregamento_id = p_carregamento_id;

  RETURN COALESCE(qtd_total, 0) - COALESCE(qtd_reservada, 0) - COALESCE(qtd_cancelada, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.on_execucao_status_change()
RETURNS TRIGGER AS $$
DECLARE
  saldo_atual NUMERIC;
BEGIN
  IF NEW.status = 'concluido' THEN
    IF NEW.quantidade_carregada IS NULL THEN
      RAISE EXCEPTION 'quantidade_carregada é obrigatória para concluir execução'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.quantidade_carregada > NEW.quantidade_agendada THEN
      RAISE EXCEPTION 'Quantidade carregada (% ton) excede agendada (% ton) para veículo %',
        ROUND(NEW.quantidade_carregada, 3),
        ROUND(NEW.quantidade_agendada, 3),
        COALESCE(NEW.placa_veiculo, 'N/A')
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.data_conclusao_carregamento IS NULL THEN
      NEW.data_conclusao_carregamento = NOW();
    END IF;
  END IF;

  NEW.atualizado_em = NOW();

  saldo_atual := public.calcular_saldo_solicitacao(NEW.carregamento_id);

  UPDATE public.carregamentos
  SET status = CASE WHEN saldo_atual = 0 THEN 'carregado' ELSE 'em_carregamento' END,
      quantidade_carregada = (
        SELECT COALESCE(SUM(COALESCE(quantidade_carregada, 0)), 0)
        FROM public.carregamento_execucoes
        WHERE carregamento_id = NEW.carregamento_id
          AND status = 'concluido'
      ),
      atualizado_em = NOW()
  WHERE id = NEW.carregamento_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_execucao_status_change ON public.carregamento_execucoes;
CREATE TRIGGER trg_on_execucao_status_change
  BEFORE INSERT OR UPDATE ON public.carregamento_execucoes
  FOR EACH ROW
  EXECUTE FUNCTION public.on_execucao_status_change();

CREATE OR REPLACE FUNCTION public.on_cancelar_saldo_solicitacao()
RETURNS TRIGGER AS $$
DECLARE
  delta_cancelado NUMERIC;
BEGIN
  delta_cancelado := COALESCE(NEW.quantidade_cancelada, 0) - COALESCE(OLD.quantidade_cancelada, 0);
  IF delta_cancelado <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.pedidos_venda_itens pvi
  SET saldo_disponivel = pvi.saldo_disponivel + proporcao.qtd
  FROM (
    SELECT ci.pedido_venda_item_id,
           CASE
             WHEN soma.total <= 0 THEN 0
             ELSE (ci.quantidade_ton / soma.total) * delta_cancelado
           END AS qtd
    FROM public.carregamento_itens ci
    CROSS JOIN (
      SELECT COALESCE(SUM(ci2.quantidade_ton), 0) AS total
      FROM public.carregamento_itens ci2
      WHERE ci2.carregamento_id = NEW.id
    ) soma
    WHERE ci.carregamento_id = NEW.id
      AND ci.pedido_venda_item_id IS NOT NULL
  ) proporcao
  WHERE pvi.id = proporcao.pedido_venda_item_id;

  IF public.calcular_saldo_solicitacao(NEW.id) = 0 THEN
    NEW.status = 'carregado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_on_cancelar_saldo_solicitacao ON public.carregamentos;
CREATE TRIGGER trg_on_cancelar_saldo_solicitacao
  BEFORE UPDATE OF quantidade_cancelada ON public.carregamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.on_cancelar_saldo_solicitacao();

NOTIFY pgrst, 'reload schema';
