-- Consolidate the single audited legacy duplicate of 04-14-08. The canonical
-- product is already linked to its saved batch. Move any history defensively
-- before deleting only the explicitly identified unlinked record.
update public.historico_precos_formulados
set produto_formulado_id = '4014f7c9-6147-4299-a391-c4df5fd4a1d2'
where produto_formulado_id = '83f26dcf-62a4-4f6e-b7f1-4a417d44cb88';

delete from public.produtos_formulados
where id = '83f26dcf-62a4-4f6e-b7f1-4a417d44cb88'
  and saved_formula_id is null
  and lower(trim(nome)) = '04-14-08'
  and formula_npk = '04-14-08';

create unique index if not exists produtos_formulados_saved_formula_id_uidx
  on public.produtos_formulados (saved_formula_id);
