-- Propostas: assinatura eletrônica do aceite (ou da recusa).
--  • Sem desenho de assinatura: o cliente se identifica pelo CPF/CNPJ e o sistema
--    registra data/hora, IP e aparelho.
--  • O conteúdo respondido (proposta, cliente, documento, produtos, quantidades,
--    preços, totais, data/hora, IP e aparelho) é gravado e resumido em SHA-256;
--    qualquer alteração posterior muda o resumo e a verificação acusa.
--  • Cada resposta ganha um código de verificação (XXXX-XXXX-XXXX) consultável
--    sem login em /verificar/<código> (QR code no comprovante). A consulta
--    mostra o documento mascarado e não expõe custo nem dados internos.

alter table public.propostas_precos_respostas
  add column if not exists conteudo_assinado jsonb,
  add column if not exists hash_assinatura text,
  add column if not exists codigo_verificacao text;
create unique index if not exists propostas_respostas_codigo_idx
  on public.propostas_precos_respostas (codigo_verificacao) where codigo_verificacao is not null;

create or replace function private.hash_conteudo_assinado(p_conteudo jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_conteudo::text, 'UTF8')), 'hex');
$$;
revoke all on function private.hash_conteudo_assinado(jsonb) from public, anon;

-- Respostas antigas também ganham assinatura (conteúdo do que foi gravado).
update public.propostas_precos_respostas r
   set conteudo_assinado = jsonb_build_object(
         'proposta', 'PROP-' || lpad(p.numero::text, 6, '0'),
         'cliente', p.cliente_nome, 'documento', r.documento, 'resposta', r.tipo,
         'motivo', r.motivo, 'itens', r.itens, 'valor_total', r.valor_total,
         'toneladas', r.toneladas_total, 'moeda', p.moeda, 'valida_ate', p.valida_ate,
         'respondido_em', to_char(r.respondido_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         'ip', r.ip, 'aparelho', r.user_agent),
       codigo_verificacao = upper(substr(md5(r.id::text || random()::text), 1, 4) || '-' ||
                                  substr(md5(r.id::text || random()::text), 1, 4) || '-' ||
                                  substr(md5(r.id::text || random()::text), 1, 4))
  from public.propostas_precos p
 where p.id = r.proposta_id and r.conteudo_assinado is null;
update public.propostas_precos_respostas
   set hash_assinatura = private.hash_conteudo_assinado(conteudo_assinado)
 where hash_assinatura is null and conteudo_assinado is not null;

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
  v_agora timestamptz := now();
  v_ip text;
  v_aparelho text;
  v_conteudo jsonb;
  v_codigo text;
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

  v_ip := nullif(btrim(left(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1), 64)), '');
  v_aparelho := left(v_headers ->> 'user-agent', 300);

  -- Assinatura eletrônica: o conteúdo aceito vira um resumo SHA-256 (qualquer
  -- alteração muda o resumo) e ganha um código de verificação público.
  v_conteudo := jsonb_build_object(
    'proposta', 'PROP-' || lpad(rec.numero::text, 6, '0'),
    'cliente', rec.cliente_nome,
    'documento', v_doc,
    'resposta', p_tipo,
    'motivo', case when p_tipo = 'recusa' then left(nullif(btrim(p_motivo), ''), 500) end,
    'itens', v_itens,
    'valor_total', round(v_total, 2),
    'toneladas', v_tons,
    'moeda', rec.moeda,
    'valida_ate', rec.valida_ate,
    'respondido_em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'ip', v_ip,
    'aparelho', v_aparelho);
  loop
    v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4) || '-' || substr(v_codigo, 9, 4);
    exit when not exists (
      select 1 from public.propostas_precos_respostas r where r.codigo_verificacao = v_codigo);
  end loop;

  insert into public.propostas_precos_respostas (
    proposta_id, tipo, documento, motivo, itens, valor_total, toneladas_total, ip, user_agent,
    respondido_em, conteudo_assinado, hash_assinatura, codigo_verificacao)
  values (
    rec.id, p_tipo, v_doc,
    case when p_tipo = 'recusa' then left(nullif(btrim(p_motivo), ''), 500) end,
    v_itens, round(v_total, 2), v_tons, v_ip, v_aparelho,
    v_agora, v_conteudo, private.hash_conteudo_assinado(v_conteudo), v_codigo);

  update public.propostas_precos
     set status = case when p_tipo = 'aceite' then 'aceita' else 'recusada' end, updated_at = now()
   where id = rec.id;

  v_mensagem := case when p_tipo = 'aceite'
    then format('%s aceitou a %s (%s produto(s), %s t).', rec.cliente_nome,
                'PROP-' || lpad(rec.numero::text, 6, '0'), jsonb_array_length(v_itens),
                replace(rtrim(rtrim(to_char(v_tons, 'FM999999990.000'), '0'), '.'), '.', ','))
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

  return jsonb_build_object('ok', true, 'codigoVerificacao', v_codigo);
end;
$$;
revoke all on function public.responder_proposta(text, text, text, jsonb, text) from public;
grant execute on function public.responder_proposta(text, text, text, jsonb, text) to anon, authenticated;

-- Documento mascarado para a página pública de verificação.
create or replace function private.mascarar_documento(p_doc text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case length(coalesce(p_doc, ''))
    when 11 then '***.' || substr(p_doc, 4, 3) || '.' || substr(p_doc, 7, 3) || '-**'
    when 14 then '**.' || substr(p_doc, 3, 3) || '.' || substr(p_doc, 6, 3) || '/' || substr(p_doc, 9, 4) || '-**'
    else '***' end;
$$;
revoke all on function private.mascarar_documento(text) from public, anon;

-- Verificação pública (QR code): confere o resumo e mostra o essencial.
create or replace function public.verificar_assinatura_proposta(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.propostas_precos_respostas;
  v_nome text;
  v_logo text;
  v_mostrar boolean;
begin
  select * into r from public.propostas_precos_respostas x
   where x.codigo_verificacao = upper(btrim(coalesce(p_codigo, '')));
  if not found then
    return jsonb_build_object('encontrada', false);
  end if;
  select s.company_name, s.company_logo, coalesce(s.show_company_name, true)
    into v_nome, v_logo, v_mostrar from public.app_settings s limit 1;
  return jsonb_build_object(
    'encontrada', true,
    'integra', r.hash_assinatura = private.hash_conteudo_assinado(r.conteudo_assinado),
    'empresa', jsonb_build_object('nome', v_nome, 'logo', v_logo, 'mostrarNome', v_mostrar),
    'codigo', r.codigo_verificacao,
    'hash', r.hash_assinatura,
    'proposta', r.conteudo_assinado ->> 'proposta',
    'cliente', r.conteudo_assinado ->> 'cliente',
    'documento', private.mascarar_documento(r.documento),
    'resposta', r.tipo,
    'respondidoEm', r.respondido_em,
    'moeda', r.conteudo_assinado ->> 'moeda',
    'valorTotal', r.valor_total,
    'toneladas', r.toneladas_total,
    'itens', (select coalesce(jsonb_agg(jsonb_build_object(
                'nome', i ->> 'nome', 'quantidade', (i ->> 'quantidade')::numeric,
                'precoTonelada', (i ->> 'precoTonelada')::numeric)), '[]'::jsonb)
                from jsonb_array_elements(r.itens) i));
end;
$$;
revoke all on function public.verificar_assinatura_proposta(text) from public;
grant execute on function public.verificar_assinatura_proposta(text) to anon, authenticated;

-- Página do cliente: devolve o código e o resumo para o comprovante com QR code.
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
      'respondidoEm', resp.respondido_em, 'ip', resp.ip, 'user_agent', resp.user_agent,
      'codigoVerificacao', resp.codigo_verificacao, 'hashAssinatura', resp.hash_assinatura) end
  );
end;
$$;
revoke all on function public.proposta_publica(text) from public;
grant execute on function public.proposta_publica(text) to anon, authenticated;
