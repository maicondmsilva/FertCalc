-- Migration: create_alert_configs
-- Creates the alert_configs table for notification/alert configuration per event type.
-- Only admin and master users can manage; all authenticated users can read.

CREATE TABLE IF NOT EXISTS public.alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_configs: leitura para autenticados"
  ON public.alert_configs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "alert_configs: escrita apenas admin/master"
  ON public.alert_configs FOR INSERT
  WITH CHECK (is_admin_or_master());

CREATE POLICY "alert_configs: atualização apenas admin/master"
  ON public.alert_configs FOR UPDATE
  USING (is_admin_or_master());

-- Seed with default alert types
INSERT INTO public.alert_configs (tipo, descricao, roles, ativo) VALUES
  ('carregamento_liberado', 'Carregamento liberado para embarque', ARRAY['master','admin','manager'], true),
  ('cotacao_aprovada', 'Cotação de frete aprovada', ARRAY['master','admin'], true),
  ('cotacao_recebida', 'Nova cotação de frete respondida', ARRAY['master','admin','manager'], true),
  ('precificacao_fechada', 'Precificação com status alterado para Fechada', ARRAY['master','admin','manager'], true),
  ('precificacao_perdida', 'Precificação com status alterado para Perdida', ARRAY['master','admin','manager'], false),
  ('meta_atingida', 'Meta de vendas atingida', ARRAY['master','admin'], true),
  ('aprovacao_solicitada', 'Nova precificação aguardando aprovação', ARRAY['master','admin'], true),
  ('aprovacao_concluida', 'Aprovação de precificação respondida', ARRAY['master','admin','manager','user'], true),
  ('produto_formulado_criado', 'Nova batida salva criada', ARRAY['master','admin'], false),
  ('pedido_venda_vinculado', 'PDF de pedido importado e vinculado', ARRAY['master','admin','manager'], false)
ON CONFLICT (tipo) DO NOTHING;
