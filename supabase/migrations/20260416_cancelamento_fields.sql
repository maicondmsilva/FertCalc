-- Novos campos em cotacoes_solicitadas para fluxo de recusa/devolução
ALTER TABLE public.cotacoes_solicitadas
  ADD COLUMN IF NOT EXISTS motivo_recusa      TEXT,
  ADD COLUMN IF NOT EXISTS recusado_por_id    UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recusado_por_nome  TEXT,
  ADD COLUMN IF NOT EXISTS recusado_em        TIMESTAMPTZ;

-- Novos campos em carregamentos para cancelamento parcial
ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS obs_cancelamento_parcial TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_por_id         UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_nome        TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_em              TIMESTAMPTZ;
