-- Índices de cobertura para as chaves estrangeiras apontadas pelo Database Advisor.

create index if not exists chat_operation_metrics_organization_id_idx
  on private.chat_operation_metrics (organization_id);

create index if not exists chat_operation_metrics_user_id_idx
  on private.chat_operation_metrics (user_id);

create index if not exists chat_message_attachments_uploaded_by_idx
  on public.chat_message_attachments (uploaded_by);


