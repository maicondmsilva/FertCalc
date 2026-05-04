-- Vincular lista de preços a um local de carregamento (opcional)
ALTER TABLE public.price_lists
  ADD COLUMN IF NOT EXISTS local_carregamento_id UUID
    REFERENCES public.locais_carregamento(id) ON DELETE SET NULL;
