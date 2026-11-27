-- Aviso da proposta aceita: toneladas com vírgula (12,5 t).
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

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.responder_proposta(text, text, text, jsonb, text) from public;
grant execute on function public.responder_proposta(text, text, text, jsonb, text) to anon, authenticated;
