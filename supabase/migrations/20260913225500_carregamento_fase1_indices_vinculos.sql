-- Índices das chaves estrangeiras apontados pelo advisor após a criação do vínculo.
create index idx_transportadora_usuarios_organization
  on public.transportadora_usuarios (organization_id);

create index idx_transportadora_usuarios_criado_por
  on public.transportadora_usuarios (criado_por)
  where criado_por is not null;
