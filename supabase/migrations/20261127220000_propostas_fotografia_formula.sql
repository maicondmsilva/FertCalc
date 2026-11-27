-- Propostas: fotografia completa de cada produto (para a precificação sair igual
-- ao que foi enviado ao cliente) e regras de criação mais firmes.
--  • propostas_precos_itens.formula: alvo N-P-K, filtro/categoria, alvos de Ca/S/
--    micros e a composição (macros e micros com quantidades) como fechou.
--  • Cliente obrigatório; região só entre as do usuário (admin: qualquer uma).
--  • A escolha de mostrar a composição passa a ser feita ao gerar o PDF/Excel;
--    a coluna incluir_composicao fica só como histórico.

alter table public.propostas_precos_itens
  add column if not exists formula jsonb not null default '{}'::jsonb;

create or replace function public.criar_proposta_precos(p_proposta jsonb, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid := (select public.get_current_organization_id());
  v_id uuid;
  v_validade date := nullif(p_proposta ->> 'valida_ate', '')::date;
  v_region uuid := nullif(p_proposta ->> 'region_id', '')::uuid;
  v_client uuid := nullif(p_proposta ->> 'client_id', '')::uuid;
  v_nome text := private.nome_usuario_atual();
  v_item jsonb;
  v_ordem integer := 0;
  v_total numeric := 0;
  v_tons numeric := 0;
begin
  if v_user is null or v_org is null then
    raise exception 'Entre no sistema para gerar a proposta.' using errcode = '42501';
  end if;
  if not private.proposta_permissao('propostas_criar') then
    raise exception 'Seu usuário não tem permissão para criar propostas.' using errcode = '42501';
  end if;
  if v_validade is null then
    raise exception 'Informe a validade da proposta.' using errcode = '22023';
  end if;
  if v_validade < current_date then
    raise exception 'A validade não pode ser anterior a hoje.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A proposta precisa de ao menos um produto.' using errcode = '22023';
  end if;
  if v_client is null then
    raise exception 'Escolha o cliente da proposta.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c where c.id = v_client and c.organization_id = v_org
  ) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  if v_region is null then
    v_region := private.regiao_principal_do_usuario(v_user);
  elsif not exists (select 1 from public.regions r where r.id = v_region and r.organization_id = v_org) then
    raise exception 'Região inválida.' using errcode = '42501';
  elsif private.app_user_hierarchy(v_user) < 80
        and not (v_region = any (private.current_user_region_ids())) then
    raise exception 'Você só pode criar propostas nas suas regiões.' using errcode = '42501';
  end if;

  insert into public.propostas_precos (
    organization_id, criado_por, criado_por_nome, region_id, client_id, cliente_nome,
    cliente_documento, cliente_dados, price_list_id, price_list_nome, local_carregamento_id,
    local_nome, moeda, taxa_cambio, valida_ate, incluir_composicao, observacoes)
  values (
    v_org, v_user, v_nome, v_region, v_client,
    coalesce(nullif(btrim(p_proposta ->> 'cliente_nome'), ''), 'Cliente não informado'),
    nullif(btrim(p_proposta ->> 'cliente_documento'), ''),
    coalesce(p_proposta -> 'cliente_dados', '{}'::jsonb),
    nullif(p_proposta ->> 'price_list_id', '')::uuid,
    nullif(p_proposta ->> 'price_list_nome', ''),
    nullif(p_proposta ->> 'local_carregamento_id', '')::uuid,
    nullif(p_proposta ->> 'local_nome', ''),
    case when p_proposta ->> 'moeda' = 'USD' then 'USD' else 'BRL' end,
    nullif(p_proposta ->> 'taxa_cambio', '')::numeric,
    v_validade,
    coalesce((p_proposta ->> 'incluir_composicao')::boolean, false),
    nullif(btrim(p_proposta ->> 'observacoes'), ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_ordem := v_ordem + 1;
    insert into public.propostas_precos_itens (
      proposta_id, ordem, saved_formula_id, codigo, formula_nome, npk, garantias, embalagem,
      preco_tonelada, quantidade_sugerida, composicao, fatores, formula)
    values (
      v_id, v_ordem,
      (select sf.id from public.saved_formulas sf
        where sf.id = nullif(v_item ->> 'saved_formula_id', '')::uuid and sf.organization_id = v_org),
      nullif(v_item ->> 'codigo', ''),
      coalesce(nullif(btrim(v_item ->> 'formula_nome'), ''), 'Produto'),
      nullif(v_item ->> 'npk', ''),
      nullif(v_item ->> 'garantias', ''),
      nullif(v_item ->> 'embalagem', ''),
      greatest(coalesce((v_item ->> 'preco_tonelada')::numeric, 0), 0),
      nullif(v_item ->> 'quantidade_sugerida', '')::numeric,
      coalesce(v_item -> 'composicao', '[]'::jsonb),
      coalesce(v_item -> 'fatores', '{}'::jsonb),
      coalesce(v_item -> 'formula', '{}'::jsonb));
    v_total := v_total + greatest(coalesce((v_item ->> 'preco_tonelada')::numeric, 0), 0)
                         * coalesce(nullif(v_item ->> 'quantidade_sugerida', '')::numeric, 0);
    v_tons := v_tons + coalesce(nullif(v_item ->> 'quantidade_sugerida', '')::numeric, 0);
  end loop;

  update public.propostas_precos set valor_total = v_total, toneladas_total = v_tons where id = v_id;

  insert into public.propostas_precos_eventos (proposta_id, tipo, descricao, dados, criado_por, criado_por_nome)
  values (v_id, 'criada',
          format('Proposta criada com %s produto(s), válida até %s.', v_ordem, to_char(v_validade, 'DD/MM/YYYY')),
          jsonb_build_object('valida_ate', v_validade), v_user, v_nome);
  return v_id;
end;
$$;
revoke all on function public.criar_proposta_precos(jsonb, jsonb) from public, anon;
grant execute on function public.criar_proposta_precos(jsonb, jsonb) to authenticated;
