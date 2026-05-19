CREATE OR REPLACE FUNCTION public.bloquear_edicao_apos_liberacao()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role
  FROM public.app_users
  WHERE id = auth.uid();

  IF caller_role IN ('master', 'admin') OR COALESCE(public.user_hierarchy_level(auth.uid()), 0) >= 80 THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'aguardando_liberacao'
     AND OLD.criado_por = auth.uid()
     AND (
       NEW.quantidade_total IS DISTINCT FROM OLD.quantidade_total
       OR NEW.tipo_frete IS DISTINCT FROM OLD.tipo_frete
       OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
     ) THEN
    RAISE EXCEPTION 'Carregamento já liberado não pode ser editado pelo solicitante'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_edicao_apos_liberacao ON public.carregamentos;
CREATE TRIGGER trg_bloquear_edicao_apos_liberacao
  BEFORE UPDATE ON public.carregamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_edicao_apos_liberacao();

CREATE OR REPLACE FUNCTION public.devolver_saldo_ao_excluir_carregamento()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'aguardando_liberacao' THEN
    UPDATE public.pedidos_venda_itens pvi
    SET saldo_disponivel = pvi.saldo_disponivel + ci.quantidade_ton
    FROM public.carregamento_itens ci
    WHERE ci.carregamento_id = OLD.id
      AND ci.pedido_venda_item_id = pvi.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_devolver_saldo_ao_excluir_carregamento ON public.carregamentos;
CREATE TRIGGER trg_devolver_saldo_ao_excluir_carregamento
  BEFORE DELETE ON public.carregamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.devolver_saldo_ao_excluir_carregamento();

NOTIFY pgrst, 'reload schema';
