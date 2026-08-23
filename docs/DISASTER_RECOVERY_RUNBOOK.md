# Recuperação de desastre do FertCalc

## Objetivo e limites

Este procedimento recupera o FertCalc após indisponibilidade, corrupção ou exclusão acidental. Nenhuma restauração deve ser iniciada sem autorização explícita: a operação pode causar perda de dados e deixa o projeto temporariamente indisponível.

Metas operacionais iniciais, a validar com o responsável pelo negócio:

- RPO com backup diário: até 24 horas de dados.
- RPO com PITR habilitado: até 2 minutos, conforme a documentação do Supabase.
- RTO: até 4 horas para restaurar, validar e liberar o acesso.
- Retenção mínima desejada: 7 dias.

## Escopo do backup

O backup gerenciado do Supabase cobre banco, esquema, dados e Auth. Ele não recupera arquivos apagados do Storage. Configurações de Auth, chaves de API, Edge Functions, Realtime e integrações também precisam ser inventariadas e reconfiguradas ao restaurar em um projeto novo.

Situação auditada em 23/08/2026:

- projeto `FertCalc 2.0` (`vadbhbyfnkrqvboiiakw`) saudável, região `us-east-2`;
- Postgres 17.6;
- 5 usuários no Auth;
- nenhum bucket ou objeto no Storage;
- `pg_cron` e `pg_net` não habilitados;
- a migration `20260823140535_create_runtime_error_events.sql` está versionada, mas ainda depende de autorização para aplicação permanente.

## Verificação semanal

1. Confirmar no painel **Database > Backups** a data e o estado do último backup.
2. Confirmar o plano e a janela de retenção. Em plano gratuito, gerar backup lógico e mantê-lo fora do repositório.
3. Se PITR estiver habilitado, conferir o primeiro e o último ponto recuperável.
4. Executar `npm run dr:check` para validar runbook, migrations e proteções contra vazamento de dumps.
5. Confirmar que migrations aprovadas no repositório também constam no histórico do banco.
6. Registrar responsável, data, resultado e correções necessárias no chamado operacional.

## Incidente e decisão de restauração

1. Declarar o incidente, interromper deploys e impedir novas gravações pela aplicação.
2. Registrar horário do último dado confirmado como íntegro e a provável causa.
3. Escolher um ponto de recuperação anterior ao incidente.
4. Preferir **Restore to a New Project** para testar a recuperação sem sobrescrever produção. A função é paga e pode gerar custo.
5. Se for indispensável restaurar o próprio projeto, obter autorização explícita do responsável e comunicar a indisponibilidade.
6. Nunca incluir tokens, senhas, dumps ou dados pessoais em commits ou artefatos públicos do CI.

## Validação antes da liberação

1. Desabilitar inicialmente automações externas no projeto restaurado.
2. Reconfigurar Auth, chaves, Edge Functions, Realtime e integrações necessárias.
3. Restaurar arquivos do Storage por uma cópia independente, caso o uso de Storage seja iniciado no futuro.
4. Executar `supabase/tests/disaster_recovery_verification.sql` com uma conexão administrativa.
5. Comparar contagens agregadas com o registro anterior ao incidente.
6. Validar login, permissões por organização, pedidos, carregamentos, precificação e relatórios.
7. Executar os advisors de segurança e desempenho.
8. Liberar o acesso somente após aceite do responsável pelo negócio.

## Retorno e pós-incidente

Se a validação falhar, manter produção bloqueada e repetir a recuperação a partir de um ponto anterior, sem apagar o ambiente que preserva evidências. Após normalizar, trocar credenciais potencialmente expostas, reativar integrações uma a uma, monitorar erros e documentar causa, perda efetiva de dados, tempo de recuperação e ações preventivas.

Referências oficiais: [Database Backups](https://supabase.com/docs/guides/platform/backups) e [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project).
