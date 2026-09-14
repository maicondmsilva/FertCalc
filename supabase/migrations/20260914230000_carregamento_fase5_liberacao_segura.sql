-- Fase 5: libera carregamentos de forma atômica, auditável e restrita.

create or replace function private.liberar_carregamento(
  p_carregamento_id uuid,
  p_tipo text,
  p_quantidade numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_users%rowtype;
  v_carregamento public.carregamentos%rowtype;
  v_quantidade_adicional numeric(15,3);
  v_quantidade_final numeric(15,3);
  v_status_novo text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_tipo not in ('total', 'parcial') then
    raise exception 'invalid release type' using errcode = '22023';
  end if;

  select * into v_carregamento
    from public.carregamentos
   where id = p_carregamento_id
   for update;

  if not found then
    raise exception 'loading not found' using errcode = 'P0002';
  end if;

  select * into v_user
    from public.app_users
   where id = (select auth.uid())
     and organization_id = v_carregamento.organization_id
     and ativo;

  if not found
     or not (
       private.app_user_hierarchy((select auth.uid())) >= 80
       or coalesce(v_user.permissions @> '{"carregamento_liberar": true}'::jsonb, false)
     )
     or not private.can_access_loading_branch(
       v_carregamento.filial_id,
       v_carregamento.criado_por,
       true
     ) then
    raise exception 'not allowed to release loading' using errcode = '42501';
  end if;

  if v_carregamento.status not in ('aguardando_liberacao', 'liberado_parcial') then
    raise exception 'loading is not awaiting release' using errcode = '23514';
  end if;

  if v_carregamento.tipo_frete = 'CIF' and v_carregamento.transportadora_id is null then
    raise exception 'carrier is required before release' using errcode = '23514';
  end if;

  if v_carregamento.quantidade_total <= 0
     or v_carregamento.quantidade_liberada < 0
     or v_carregamento.quantidade_liberada >= v_carregamento.quantidade_total then
    raise exception 'loading has no quantity available for release' using errcode = '23514';
  end if;

  v_quantidade_adicional := case
    when p_tipo = 'total' then
      v_carregamento.quantidade_total - v_carregamento.quantidade_liberada
    else round(coalesce(p_quantidade, 0), 3)
  end;

  if v_quantidade_adicional <= 0
     or v_quantidade_adicional >
       (v_carregamento.quantidade_total - v_carregamento.quantidade_liberada) then
    raise exception 'release quantity exceeds available balance' using errcode = '23514';
  end if;

  v_quantidade_final := v_carregamento.quantidade_liberada + v_quantidade_adicional;
  v_status_novo := case
    when v_quantidade_final = v_carregamento.quantidade_total then 'liberado_total'
    else 'liberado_parcial'
  end;

  update public.carregamentos
     set tipo_liberacao = case when v_status_novo = 'liberado_total' then 'total' else 'parcial' end,
         quantidade_liberada = v_quantidade_final,
         saldo_disponivel = greatest(quantidade_total - v_quantidade_final, 0),
         status = v_status_novo,
         data_liberacao = now(),
         liberado_por = (select auth.uid()),
         atualizado_em = now()
   where id = v_carregamento.id
     and organization_id = v_carregamento.organization_id;

  insert into public.historico_carregamento (
    carregamento_id,
    status_anterior,
    status_novo,
    descricao,
    alterado_por,
    organization_id
  ) values (
    v_carregamento.id,
    v_carregamento.status,
    v_status_novo,
    format(
      'Liberação de %s ton confirmada. Total liberado: %s de %s ton.',
      v_quantidade_adicional,
      v_quantidade_final,
      v_carregamento.quantidade_total
    ),
    (select auth.uid()),
    v_carregamento.organization_id
  );

  return jsonb_build_object(
    'carregamento_id', v_carregamento.id,
    'status', v_status_novo,
    'quantidade_adicional', v_quantidade_adicional,
    'quantidade_liberada', v_quantidade_final,
    'saldo_liberacao', greatest(v_carregamento.quantidade_total - v_quantidade_final, 0)
  );
end;
$$;

revoke all on function private.liberar_carregamento(uuid, text, numeric)
  from public, anon;
grant execute on function private.liberar_carregamento(uuid, text, numeric)
  to authenticated;

create or replace function public.liberar_carregamento(
  p_carregamento_id uuid,
  p_tipo text,
  p_quantidade numeric default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.liberar_carregamento(p_carregamento_id, p_tipo, p_quantidade);
$$;

revoke all on function public.liberar_carregamento(uuid, text, numeric)
  from public, anon;
grant execute on function public.liberar_carregamento(uuid, text, numeric)
  to authenticated;

comment on function public.liberar_carregamento(uuid, text, numeric) is
  'API autenticada para liberação total ou parcial de um carregamento.';

notify pgrst, 'reload schema';
