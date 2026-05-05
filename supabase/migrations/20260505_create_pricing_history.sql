CREATE TABLE IF NOT EXISTS public.pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id UUID NOT NULL REFERENCES pricings(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_por TEXT NOT NULL,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_history: leitura autenticados"
  ON public.pricing_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pricing_history: insert autenticados"
  ON public.pricing_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
