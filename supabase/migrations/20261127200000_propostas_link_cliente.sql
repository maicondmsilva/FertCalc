-- Propostas — Parte 3: link para o cliente aceitar ou recusar.
--  • Cada proposta pode ter um link com um código aleatório (≈244 bits). Para
--    procurar a proposta pelo link, o banco usa só o resumo SHA-256 do código.
--    O código em si fica no esquema private (fora da API) para o vendedor
--    copiar o link de novo; só sai pela função link_proposta, que confere acesso.
--  • O cliente (sem login) vê só o que está na proposta e responde uma única vez:
--    aceite (CPF/CNPJ + produtos e quantidades) ou recusa (CPF/CNPJ + motivo opcional).
--  • A resposta guarda data/hora, IP e aparelho como comprovante e avisa o vendedor.
--  • "Gerar precificação" liga a precificação salva à proposta (convertida).

alter table public.propostas_precos
  add column if not exists token_hash text,
  add column if not exists link_gerado_em timestamptz,
  add column if not exists link_aberto_em timestamptz;
create unique index if not exists propostas_precos_token_hash_idx
  on public.propostas_precos (token_hash) where token_hash is not null;

create table if not exists private.propostas_links (
  proposta_id uuid primary key references public.propostas_precos (id) on delete cascade,
  token text not null,
  criado_em timestamptz not null default now()
);
revoke all on private.propostas_links from public, anon, authenticated;

create table if not exists public.propostas_precos_respostas (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null unique references public.propostas_precos (id) on delete cascade,
  tipo text not null check (tipo in ('aceite', 'recusa')),
  documento text not null,
  motivo text,
  itens jsonb not null default '[]'::jsonb,
  valor_total numeric(15, 2) not null default 0,
  toneladas_total numeric(15, 3) not null default 0,
  ip text,
  user_agent text,
  respondido_em timestamptz not null default now()
);
alter table public.propostas_precos_respostas enable row level security;
drop policy if exists propostas_respostas_select on public.propostas_precos_respostas;
create policy propostas_respostas_select on public.propostas_precos_respostas for select to authenticated
  using (exists (select 1 from public.propostas_precos p where p.id = proposta_id));
grant select on public.propostas_precos_respostas to authenticated;
revoke insert, update, delete on public.propostas_precos_respostas from authenticated, anon;
revoke all on public.propostas_precos, public.propostas_precos_itens, public.propostas_precos_eventos,
  public.propostas_precos_respostas from anon;

create or replace function private.hash_token_proposta(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;
revoke all on function private.hash_token_proposta(text) from public, anon;

-- Cria (ou devolve) o link da proposta. Devolve só o código; a tela monta a URL.
create or replace function public.link_proposta(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
  v_token text;
begin
  rec := private.proposta_para_alterar(p_id);
  if not private.proposta_permissao('propostas_criar') then
    raise exception 'Seu usuário não tem permissão para enviar propostas.' using errcode = '42501';
  end if;
  select l.token into v_token from private.propostas_links l where l.proposta_id = rec.id;
  if v_token is not null then
    return v_token;
  end if;
  if rec.status <> 'vigente' or rec.valida_ate < current_date then
    raise exception 'Só é possível enviar o link de proposta vigente.' using errcode = '22023';
  end if;
  v_token := translate(
    encode(decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
    '+/=', '-_');
  insert into private.propostas_links (proposta_id, token) values (rec.id, v_token);
  update public.propostas_precos
     set token_hash = private.hash_token_proposta(v_token), link_gerado_em = now(), updated_at = now()
   where id = rec.id;
  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, criado_por, criado_por_nome)
  values (rec.id, 'link_gerado', 'Link para o cliente gerado.', (select auth.uid()), private.nome_usuario_atual());
  return v_token;
end;
$$;
revoke all on function public.link_proposta(uuid) from public, anon;
grant execute on function public.link_proposta(uuid) to authenticated;

-- Dados que o cliente vê pelo link (sem login). Nada de custo ou margem.
create or replace function public.proposta_publica(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
  resp public.propostas_precos_respostas;
  v_empresa_nome text;
  v_empresa_logo text;
  v_mostrar_nome boolean := true;
  v_situacao text;
begin
  if coalesce(length(p_token), 0) < 20 then
    return jsonb_build_object('encontrada', false);
  end if;
  select * into rec from public.propostas_precos p
   where p.token_hash = private.hash_token_proposta(p_token);
  if not found then
    return jsonb_build_object('encontrada', false);
  end if;

  if rec.link_aberto_em is null then
    update public.propostas_precos set link_aberto_em = now() where id = rec.id;
    insert into public.propostas_precos_eventos (proposta_id, tipo, descricao)
    values (rec.id, 'link_aberto', 'O cliente abriu o link da proposta.');
  end if;

  select * into resp from public.propostas_precos_respostas r where r.proposta_id = rec.id;
  select s.company_name, s.company_logo, coalesce(s.show_company_name, true)
    into v_empresa_nome, v_empresa_logo, v_mostrar_nome from public.app_settings s limit 1;
  v_situacao := case when rec.status = 'vigente' and rec.valida_ate < current_date then 'vencida' else rec.status end;

  return jsonb_build_object(
    'encontrada', true,
    'empresa', jsonb_build_object(
      'nome', v_empresa_nome, 'logo', v_empresa_logo, 'mostrarNome', coalesce(v_mostrar_nome, true)),
    'proposta', jsonb_build_object(
      'numero', rec.numero, 'clienteNome', rec.cliente_nome, 'vendedor', rec.criado_por_nome,
      'localNome', rec.local_nome, 'moeda', rec.moeda, 'validaAte', rec.valida_ate,
      'observacoes', rec.observacoes, 'situacao', v_situacao,
      'podeResponder', v_situacao = 'vigente' and resp.id is null),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'nome', i.formula_nome, 'npk', i.npk, 'embalagem', i.embalagem,
               'precoTonelada', i.preco_tonelada, 'quantidadeSugerida', i.quantidade_sugerida)
             order by i.ordem)
        from public.propostas_precos_itens i where i.proposta_id = rec.id), '[]'::jsonb),
    'resposta', case when resp.id is null then null else jsonb_build_object(
      'tipo', resp.tipo, 'documento', resp.documento, 'motivo', resp.motivo, 'itens', resp.itens,
      'valorTotal', resp.valor_total, 'toneladasTotal', resp.toneladas_total,
      'respondidoEm', resp.respondido_em) end
  );
end;
$$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;

-- Resposta do cliente: aceite (com produtos e quantidades) ou recusa.
create or replace function public.responder_proposta(
  p_token text, p_tipo text, p_documento text, p_itens jsonb, p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
  v_doc text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_headers jsonb;
  v_itens jsonb := '[]'::jsonb;
  v_item jsonb;
  v_linha public.propostas_precos_itens;
  v_qtd numeric;
  v_total numeric := 0;
  v_tons numeric := 0;
  v_mensagem text;
begin
  if p_tipo not in ('aceite', 'recusa') then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  select * into rec from public.propostas_precos p
   where p.token_hash = private.hash_token_proposta(p_token)
   for update;
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if rec.status <> 'vigente' or rec.valida_ate < current_date
     or exists (select 1 from public.propostas_precos_respostas r where r.proposta_id = rec.id) then
    raise exception 'Esta proposta não aceita mais respostas. Fale com seu vendedor.' using errcode = '22023';
  end if;
  if length(v_doc) not in (11, 14) or v_doc ~ '^(\d)\1+$' then
    raise exception 'Informe um CPF ou CNPJ válido.' using errcode = '22023';
  end if;

  if p_tipo = 'aceite' then
    if jsonb_typeof(p_itens) <> 'array' then
      raise exception 'Escolha ao menos um produto.' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(p_itens) loop
      v_qtd := nullif(v_item ->> 'quantidade', '')::numeric;
      continue when v_qtd is null or v_qtd <= 0;
      if v_qtd > 100000 then
        raise exception 'Quantidade muito alta.' using errcode = '22023';
      end if;
      select * into v_linha from public.propostas_precos_itens i
       where i.id = nullif(v_item ->> 'id', '')::uuid and i.proposta_id = rec.id;
      if not found then
        raise exception 'Produto não pertence à proposta.' using errcode = '22023';
      end if;
      v_itens := v_itens || jsonb_build_object(
        'id', v_linha.id, 'nome', v_linha.formula_nome, 'npk', v_linha.npk,
        'savedFormulaId', v_linha.saved_formula_id, 'precoTonelada', v_linha.preco_tonelada,
        'quantidade', round(v_qtd, 3));
      v_total := v_total + v_linha.preco_tonelada * round(v_qtd, 3);
      v_tons := v_tons + round(v_qtd, 3);
    end loop;
    if jsonb_array_length(v_itens) = 0 then
      raise exception 'Escolha ao menos um produto e informe a quantidade.' using errcode = '22023';
    end if;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  insert into public.propostas_precos_respostas (
    proposta_id, tipo, documento, motivo, itens, valor_total, toneladas_total, ip, user_agent)
  values (
    rec.id, p_tipo, v_doc,
    case when p_tipo = 'recusa' then left(nullif(btrim(p_motivo), ''), 500) end,
    v_itens, round(v_total, 2), v_tons,
    left(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), 64),
    left(v_headers ->> 'user-agent', 300));

  update public.propostas_precos
     set status = case when p_tipo = 'aceite' then 'aceita' else 'recusada' end, updated_at = now()
   where id = rec.id;

  v_mensagem := case when p_tipo = 'aceite'
    then format('%s aceitou a %s (%s produto(s), %s t).', rec.cliente_nome,
                'PROP-' || lpad(rec.numero::text, 6, '0'), jsonb_array_length(v_itens),
                trim(to_char(v_tons, 'FM999G999G990D999')))
    else format('%s recusou a %s.', rec.cliente_nome, 'PROP-' || lpad(rec.numero::text, 6, '0')) end;

  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados)
  values (rec.id, case when p_tipo = 'aceite' then 'aceita' else 'recusada' end,
          v_mensagem || case when p_tipo = 'recusa' and nullif(btrim(p_motivo), '') is not null
                             then ' Motivo: ' || left(btrim(p_motivo), 500) else '' end,
          jsonb_build_object('documento', v_doc));

  insert into public.notifications (
    user_id, title, message, date, read, is_read, type, data_id, group_type, action_url, metadata)
  values (
    rec.criado_por::text,
    case when p_tipo = 'aceite' then 'Proposta aceita' else 'Proposta recusada' end,
    v_mensagem, now()::text, false, false,
    case when p_tipo = 'aceite' then 'PROPOSTA_ACEITA' else 'PROPOSTA_RECUSADA' end,
    rec.id::text, 'PROPOSTAS', '/saved_formulas',
    jsonb_build_object('propostaId', rec.id, 'numero', rec.numero));

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.responder_proposta(text, text, text, jsonb, text) from public;
grant execute on function public.responder_proposta(text, text, text, jsonb, text) to anon, authenticated;

-- Liga a precificação gerada a partir do aceite.
create or replace function public.converter_proposta(p_id uuid, p_pricing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.propostas_precos;
begin
  rec := private.proposta_para_alterar(p_id);
  if rec.status <> 'aceita' then
    raise exception 'Só proposta aceita vira precificação.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pricing_records pr
     where pr.id = p_pricing_id and pr.organization_id = rec.organization_id
  ) then
    raise exception 'Precificação não encontrada.' using errcode = 'P0002';
  end if;
  update public.propostas_precos
     set status = 'convertida', pricing_id = p_pricing_id, updated_at = now()
   where id = rec.id;
  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (rec.id, 'convertida', 'Precificação gerada a partir do aceite.',
          jsonb_build_object('pricing_id', p_pricing_id), (select auth.uid()), private.nome_usuario_atual());
end;
$$;
revoke all on function public.converter_proposta(uuid, uuid) from public, anon;
grant execute on function public.converter_proposta(uuid, uuid) to authenticated;
