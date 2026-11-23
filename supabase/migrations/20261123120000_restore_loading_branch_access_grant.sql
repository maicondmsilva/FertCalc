-- As regras de acesso da tabela carregamentos chamam
-- private.can_access_loading_branch, mas a migração de 31/08 tirou a permissão
-- de execução dos usuários logados. Com isso toda consulta que encontrava
-- registros falhava com "permission denied for function". A função roda
-- com os privilégios do dono e só responde sobre o próprio usuário logado.
grant execute on function private.can_access_loading_branch(uuid, uuid, boolean)
  to authenticated;
