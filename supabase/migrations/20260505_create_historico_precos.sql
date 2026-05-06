CREATE TABLE IF NOT EXISTS public.historico_precos_formulados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_formulado_id UUID NOT NULL REFERENCES produtos_formulados(id) ON DELETE CASCADE,
  preco_final NUMERIC(10,2) NOT NULL,
  pricing_id UUID,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por TEXT
);
ALTER TABLE public.historico_precos_formulados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico_precos: leitura autenticados"
  ON public.historico_precos_formulados FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "historico_precos: insert autenticados"
  ON public.historico_precos_formulados FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
