UPDATE public.carregamentos
SET status = 'aguardando_liberacao',
    atualizado_em = NOW()
WHERE status IN ('aguardando_cotacao', 'cotacao_solicitada', 'cotacao_recebida');

INSERT INTO public.audit_log (
  tabela,
  registro_id,
  acao,
  motivo,
  usuario_id,
  usuario_nome,
  dados_anteriores,
  dados_novos
)
SELECT
  'carregamentos',
  c.id,
  'UPDATE',
  'Migração V5: unificação de fluxo CIF/FOB',
  '00000000-0000-0000-0000-000000000000',
  'SISTEMA',
  jsonb_build_object('status_anterior', 'cotacao'),
  jsonb_build_object('status_novo', 'aguardando_liberacao')
FROM public.carregamentos c
WHERE c.status = 'aguardando_liberacao'
  AND c.atualizado_em > NOW() - INTERVAL '5 minutes';

NOTIFY pgrst, 'reload schema';
