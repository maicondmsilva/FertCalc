CREATE TABLE IF NOT EXISTS public.carregamento_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_numeric BIGSERIAL UNIQUE,
  carregamento_id UUID NOT NULL REFERENCES public.carregamentos(id) ON DELETE RESTRICT,
  motorista_nome TEXT NOT NULL,
  motorista_cpf TEXT,
  placa_veiculo TEXT NOT NULL,
  placa_carreta TEXT,
  quantidade_agendada NUMERIC(12,3) NOT NULL CHECK (quantidade_agendada > 0),
  quantidade_carregada NUMERIC(12,3),
  data_agendamento TIMESTAMPTZ DEFAULT NOW(),
  data_inicio_carregamento TIMESTAMPTZ,
  data_conclusao_carregamento TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'em_carregamento', 'concluido', 'cancelado')),
  motivo_cancelamento TEXT,
  observacoes TEXT,
  criado_por UUID REFERENCES public.app_users(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carregamento_execucoes_carregamento
  ON public.carregamento_execucoes(carregamento_id);

CREATE INDEX IF NOT EXISTS idx_carregamento_execucoes_status
  ON public.carregamento_execucoes(status);

ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS quantidade_cancelada NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento_saldo TEXT;

ALTER TABLE public.carregamento_execucoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'carregamento_execucoes'
      AND policyname = 'carregamento_execucoes_select'
  ) THEN
    CREATE POLICY "carregamento_execucoes_select"
    ON public.carregamento_execucoes FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'carregamento_execucoes'
      AND policyname = 'carregamento_execucoes_write'
  ) THEN
    CREATE POLICY "carregamento_execucoes_write"
    ON public.carregamento_execucoes FOR ALL TO authenticated
    USING (
      COALESCE(public.user_hierarchy_level(auth.uid()), 0) >= 80
      OR EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = auth.uid()
          AND COALESCE((u.permissions->>'carregamento_logistica')::boolean, false) = true
      )
    )
    WITH CHECK (
      COALESCE(public.user_hierarchy_level(auth.uid()), 0) >= 80
      OR EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.id = auth.uid()
          AND COALESCE((u.permissions->>'carregamento_logistica')::boolean, false) = true
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
