-- ============================================================
-- MÓDULO: CONTROLE DE GASTOS — TABELA DE CARTÕES
-- Execute este script no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150)   NOT NULL,
  last_four   CHAR(4),
  user_id     UUID,
  church_id   VARCHAR(100),
  active      BOOLEAN        NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.credit_cards IS 'Cartões de crédito corporativos do módulo de gastos';
COMMENT ON COLUMN public.credit_cards.last_four IS '4 últimos dígitos do cartão';
COMMENT ON COLUMN public.credit_cards.user_id   IS 'UUID do usuário responsável pelo cartão (referência a app_users)';

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_active  ON public.credit_cards (active);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE TRIGGER trg_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
