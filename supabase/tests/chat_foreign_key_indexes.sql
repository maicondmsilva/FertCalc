do $$
declare
  expected_index text;
begin
  foreach expected_index in array array[
    'private.chat_operation_metrics_organization_id_idx',
    'private.chat_operation_metrics_user_id_idx',
    'public.chat_message_attachments_uploaded_by_idx'
  ] loop
    if to_regclass(expected_index) is null then
      raise exception 'Índice obrigatório ausente: %', expected_index;
    end if;

    if not exists (
      select 1
      from pg_index index_definition
      where index_definition.indexrelid = to_regclass(expected_index)
        and index_definition.indisvalid
        and index_definition.indisready
    ) then
      raise exception 'Índice inválido ou indisponível: %', expected_index;
    end if;
  end loop;
end;
$$;


