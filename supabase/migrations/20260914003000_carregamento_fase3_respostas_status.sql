-- Mantém o painel interno sincronizado quando a transportadora responde pelo portal.

create or replace function private.sync_carregamento_cotacao_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'respondida' and old.status is distinct from new.status then
    update public.carregamentos
       set status = 'cotacao_recebida',
           atualizado_em = now()
     where id = new.carregamento_id
       and organization_id = new.organization_id
       and status in ('aguardando_cotacao', 'cotacao_solicitada');
  elsif new.status = 'recusada' and old.status is distinct from new.status then
    if not exists (
      select 1
        from public.cotacoes_frete cf
       where cf.carregamento_id = new.carregamento_id
         and cf.organization_id = new.organization_id
         and cf.id <> new.id
         and not cf.arquivada
         and cf.status in ('pendente', 'respondida', 'aprovada')
    ) then
      update public.carregamentos
         set status = 'aguardando_cotacao',
             atualizado_em = now()
       where id = new.carregamento_id
         and organization_id = new.organization_id
         and status in ('cotacao_solicitada', 'cotacao_recebida');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_carregamento_cotacao_response() from public, anon, authenticated;

drop trigger if exists trg_sync_carregamento_cotacao_response on public.cotacoes_frete;
create trigger trg_sync_carregamento_cotacao_response
after update of status on public.cotacoes_frete
for each row execute function private.sync_carregamento_cotacao_response();

comment on function private.sync_carregamento_cotacao_response() is
  'Sincroniza o status do carregamento após resposta ou recusa da transportadora.';

