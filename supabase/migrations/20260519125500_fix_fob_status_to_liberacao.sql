UPDATE carregamentos
SET
  status = 'aguardando_liberacao',
  atualizado_em = NOW()
WHERE tipo_frete = 'FOB'
  AND status IN ('aguardando_cotacao', 'cotacao_solicitada', 'cotacao_recebida');
