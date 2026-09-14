-- Fase 4: aprovação atômica da proposta vencedora e aplicação do frete.

create or replace function public.aprovar_cotacao_frete(p_cotacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.app_users%rowtype;
  v_cotacao public.cotacoes_frete%rowtype;
  v_carregamento public.carregamentos%rowtype;
  v_pode_aprovar boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_cotacao
    from public.cotacoes_frete
   where id = p_cotacao_id
   for update;

  if not found or coalesce(v_cotacao.arquivada, false) then
    raise exception 'quote unavailable' using errcode = 'P0002';
  end if;

  select * into v_user
    from public.app_users
   where id = (select auth.uid())
     and organization_id = v_cotacao.organization_id
     and ativo;

  v_pode_aprovar := found and (
    private.app_user_hierarchy((select auth.uid())) >= 80
    or coalesce((v_user.permissions ->> 'carregamento_aprovar_cotacao')::boolean, false)
  );

  if not v_pode_aprovar then
    raise exception 'not allowed to approve freight quote' using errcode = '42501';
  end if;

  if v_cotacao.status <> 'respondida' or v_cotacao.valor_cotado is null
     or v_cotacao.valor_cotado <= 0 then
    raise exception 'quote is not ready for approval' using errcode = '23514';
  end if;

  if v_cotacao.validade_cotacao is not null
     and v_cotacao.validade_cotacao < current_date then
    raise exception 'quote has expired' using errcode = '23514';
  end if;

  select * into v_carregamento
    from public.carregamentos
   where id = v_cotacao.carregamento_id
     and organization_id = v_cotacao.organization_id
   for update;

  if not found or v_carregamento.status not in ('cotacao_solicitada', 'cotacao_recebida') then
    raise exception 'loading is not awaiting a freight quote' using errcode = '23514';
  end if;

  update public.cotacoes_frete
     set status = case when id = v_cotacao.id then 'aprovada' else 'reprovada' end,
         atualizado_em = now()
   where carregamento_id = v_cotacao.carregamento_id
     and organization_id = v_cotacao.organization_id
     and coalesce(arquivada, false) = false
     and status in ('pendente', 'respondida');

  update public.carregamentos
     set transportadora_id = v_cotacao.transportadora_id,
         valor_frete = v_cotacao.valor_cotado,
         valor_frete_unitario = case
           when quantidade_total > 0 then round(v_cotacao.valor_cotado / quantidade_total, 4)
           else null
         end,
         status = 'aguardando_liberacao',
         atualizado_em = now()
   where id = v_carregamento.id
     and organization_id = v_carregamento.organization_id;

  return jsonb_build_object(
    'cotacao_id', v_cotacao.id,
    'carregamento_id', v_carregamento.id,
    'transportadora_id', v_cotacao.transportadora_id,
    'valor_frete', v_cotacao.valor_cotado
  );
end;
$$;

revoke all on function public.aprovar_cotacao_frete(uuid) from public, anon;
grant execute on function public.aprovar_cotacao_frete(uuid) to authenticated;

comment on function public.aprovar_cotacao_frete(uuid) is
  'Aprova uma proposta respondida, reprova as concorrentes e aplica o frete ao carregamento de forma atômica.';

