begin;
select plan(12);

select has_table('public', 'transportadora_usuarios', 'vínculos de transportadoras existem');
select rls_enabled('public', 'transportadora_usuarios', 'RLS está ativa nos vínculos');
select has_index('public', 'transportadora_usuarios', 'idx_transportadora_usuarios_transportadora', 'consulta do vínculo está indexada');

select policies_are(
  'public',
  'transportadora_usuarios',
  array[
    'transportadora_usuarios_delete_admin',
    'transportadora_usuarios_insert_admin',
    'transportadora_usuarios_select',
    'transportadora_usuarios_update_admin'
  ],
  'vínculos possuem somente as políticas esperadas'
);

select policies_are(
  'public',
  'cotacoes_frete',
  array[
    'cotacoes_frete_delete_organization',
    'cotacoes_frete_insert_internal',
    'cotacoes_frete_select_internal_or_assigned',
    'cotacoes_frete_update_assigned_carrier',
    'cotacoes_frete_update_internal'
  ],
  'cotações separam acesso interno e acesso da transportadora'
);

select has_function('private', 'current_transportadora_id', array[]::text[], 'função de vínculo existe');
select function_returns('private', 'current_transportadora_id', array[]::text[], 'uuid', 'função retorna UUID');
select volatility_is('private', 'current_transportadora_id', array[]::text[], 'stable', 'consulta do vínculo é estável');
select has_trigger('public', 'cotacoes_frete', 'enforce_carrier_quote_update', 'trava de alteração existe');
select col_is_fk('public', 'transportadora_usuarios', 'user_id', 'usuário referencia Auth');
select col_is_fk('public', 'transportadora_usuarios', 'organization_id', 'organização possui integridade referencial');
select col_is_unique('public', 'transportadora_usuarios', 'user_id', 'um usuário pertence a uma única transportadora');

select * from finish();
rollback;
