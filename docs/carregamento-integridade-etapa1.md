# Carregamento — integridade operacional (etapa 1)

## Comportamento

- Agendar reserva volume liberado e não altera o status para carregado.
- Iniciar uma execução coloca a solicitação em carregamento.
- Concluir registra somente a quantidade física; diferença do agendamento volta ao saldo.
- A solicitação só conclui quando toda a quantidade original, descontados cancelamentos, foi carregada.
- Cancelamento mantém a quantidade original, registra a quantidade cancelada e libera a reserva do pedido na mesma transação.
- Volume carregado ou reservado em veículos não pode ser cancelado.
- Cancelamento consome primeiro o volume não liberado. Liberação vigente fica limitada à quantidade líquida.
- Selecionar transportadora não inicia uma execução.
- Falha ao consultar execuções bloqueia movimentações até uma consulta bem-sucedida.

## Entrega

Aplicar a migration `20260915003258_carregamento_integridade_status_saldos.sql`
antes de publicar o frontend, pois as telas passam a usar `cancelar_saldo_carregamento`.
Clientes antigos que alteram status e quantidades diretamente devem atualizar a página.

A migration mantém as assinaturas existentes de agendamento, transição e liberação.
Preserva os controles de organização, filial e usuário das rotinas anteriores.
Cancelamentos são registrados em histórico e auditoria na mesma transação.

## Verificação

- `supabase/tests/carregamento_integridade_status_saldos.sql`: agendamento integral/parcial, sobre-reserva, quantidade abaixo da precisão, conclusão parcial/duplicada, cancelamento reservado, liberação após cancelamento e negativa por permissão.
- O teste SQL termina em ROLLBACK. Executar primeiro em ambiente de desenvolvimento.
- Testes locais executados em PostgreSQL isolado (PGlite), com tabelas mínimas e substitutos para autenticação, acesso à filial e auditoria. Isso valida as rotinas SQL; não substitui a validação das políticas RLS e dos gatilhos de pedidos no ambiente integrado.
- Testes de interface cobrem falha de consulta, bloqueio de ações e separação entre reserva e carga.

## Reconciliação histórica

`supabase/tests/carregamento_reconciliacao_pendente.sql` é uma consulta somente leitura.
CAR-2026-0001 e CAR-2026-0002 têm status carregado, data real e quantidade física zero, sem execuções/histórico.
Não há evidência suficiente para reabri-los nem para preencher a quantidade automaticamente.
Conferir os documentos operacionais antes de corrigir esses dois registros.

## Fora desta etapa

Criação atômica de solicitação e produtos, revisão geral de RLS/portal,
publicação Realtime dos alertas, numeração concorrente e revisão de relatórios/indicadores
permanecem nas etapas seguintes do plano.
