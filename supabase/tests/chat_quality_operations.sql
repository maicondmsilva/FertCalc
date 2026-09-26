begin;

insert into public.organizations (id, name, slug) values
  ('6a000000-0000-4000-8000-000000000001', 'Chat Operação', 'chat-operacao');

insert into public.app_users (
  id, organization_id, email, name, password, role, permissions,
  managed_user_ids, filiais_permitidas, ativo
) values (
  '6b000000-0000-4000-8000-000000000001',
  '6a000000-0000-4000-8000-000000000001',
  'chat-operation@example.test', 'Chat Operação', '', 'user',
  '{"chat_access":true}', '{}', '{}', true
);

insert into private.chat_operation_metrics (
  organization_id, user_id, operation, status, duration_ms, created_at
) values
  ('6a000000-0000-4000-8000-000000000001',
   '6b000000-0000-4000-8000-000000000001',
   'message_send', 'success', 20, now() - interval '120 days'),
  ('6a000000-0000-4000-8000-000000000001',
   '6b000000-0000-4000-8000-000000000001',
   'message_send', 'success', 20, now());

do $$
declare
  candidates bigint;
  deleted_count integer;
begin
  select preview.candidate_count
    into candidates
  from private.preview_chat_retention() preview
  where preview.dataset = 'operation_metrics';

  if candidates <> 1 then
    raise exception 'A prévia de retenção retornou % candidatos; esperado 1.', candidates;
  end if;

  deleted_count := private.apply_chat_metrics_retention(100);
  if deleted_count <> 1 then
    raise exception 'A retenção removeu % métricas; esperado 1.', deleted_count;
  end if;
  if (select count(*) from private.chat_operation_metrics
      where user_id = '6b000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'A métrica dentro do prazo foi removida indevidamente.';
  end if;

  begin
    perform private.apply_chat_metrics_retention(0);
    raise exception 'A retenção aceitou um lote inválido.';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

set local role authenticated;
do $$
begin
  if has_function_privilege('authenticated', 'private.preview_chat_retention()', 'execute')
     or has_function_privilege(
       'authenticated', 'private.apply_chat_metrics_retention(integer)', 'execute'
     ) then
    raise exception 'Funções operacionais foram expostas ao cliente autenticado.';
  end if;
end;
$$;

rollback;

