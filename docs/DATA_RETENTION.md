# Política de retenção de dados

## Padrões iniciais

| Conjunto | Retenção | Execução | Proteção |
|---|---:|---|---|
| Notificações lidas | 180 dias | Habilitada na política, sem agendamento | Notificações não lidas nunca entram na limpeza |
| Erros de runtime | 90 dias | Habilitada na política, sem agendamento | Exclusão limitada por lote |
| Auditoria geral | 5 anos | Desabilitada | Exige aprovação jurídica e operacional |
| Auditoria de carregamento | 5 anos | Desabilitada | Exige aprovação jurídica e operacional |

A migration não habilita `pg_cron`, não agenda tarefas e não remove dados ao ser aplicada. Ela cria controles privados, uma prévia somente leitura e uma função administrativa de limpeza em lotes.

## Operação segura

1. Confirmar que existe backup recente e verificar o ambiente de recuperação.
2. Executar `select * from private.preview_data_retention();` e registrar as quantidades.
3. Revisar bloqueios, volume e horário de menor movimento.
4. Executar um lote pequeno com `select * from private.apply_data_retention(1000);` usando uma conexão administrativa.
5. Conferir `private.data_retention_runs`, métricas do banco e funcionamento da aplicação.
6. Repetir os lotes somente enquanto o banco estiver saudável.

Somente `service_role` e funções administrativas do banco recebem acesso. Usuários `anon` e `authenticated` não conseguem consultar a configuração nem executar exclusões.

## Agendamento

O agendamento fica deliberadamente fora desta migration. Depois de validar a limpeza manual em homologação e produção, ele poderá ser criado com Supabase Cron. Jobs devem ser criados e alterados pelas funções `cron.schedule`, `cron.alter_job` e `cron.unschedule`, nunca por escrita direta em `cron.job`.

Referências oficiais: [exclusão segura de dados](https://supabase.com/docs/guides/database/postgres/data-deletion) e [Supabase Cron](https://supabase.com/docs/guides/cron).
