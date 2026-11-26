-- Validade da cotação de frete aprovada.
-- Quem cota (logística) define até quando o solicitante pode usar o valor; depois
-- disso a cotação deixa de aparecer na busca da precificação. Cotações antigas
-- ficam sem data (continuam disponíveis).
alter table public.cotacoes_solicitadas
  add column if not exists validade_ate date;

comment on column public.cotacoes_solicitadas.validade_ate is
  'Até quando a cotação aprovada fica disponível para o solicitante vincular na precificação.';
