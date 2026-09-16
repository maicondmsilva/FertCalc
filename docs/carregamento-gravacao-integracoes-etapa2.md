# Carregamento — gravação e integrações (etapa 2)

## Resultado

- A solicitação e seus produtos são gravados em uma única transação.
- Uma chave da tentativa acompanha o formulário. Reenvio do mesmo formulário recupera
  a solicitação já criada em vez de gerar duplicidade.
- O banco atribui os números `CAR-AAAA-NNNN` e `COT-AAAA-NNNN` com contador bloqueado
  por prefixo. Operações simultâneas não escolhem o mesmo número.
- O número explícito continua preservado em importações administrativas executadas
  sem sessão de usuário; o contador avança para não reutilizá-lo.
- Pedido, produtos, filial, local e precificação são conferidos na organização atual.
  Solicitações concorrentes do mesmo pedido bloqueiam e conferem novamente os saldos.
- A exclusão de uma solicitação pendente registra auditoria na mesma transação.
  Solicitações liberadas ou com execução devem usar cancelamento.
- Falhas de atualização, cotação, transportadora e alerta são propagadas para a tela,
  evitando mensagens de sucesso quando nenhuma linha foi alterada.
- O status do pedido é sincronizado pelos gatilhos do banco. A operação não depende
  mais de uma consulta posterior disparada pelo navegador.

## Ordem de publicação

1. A migration da etapa 1, `20260915003258_carregamento_integridade_status_saldos.sql`,
   precisa estar aplicada.
2. Aplicar `20260915011830_carregamento_gravacao_integracoes.sql`.
3. Publicar o frontend desta etapa.

O frontend chama `criar_carregamento` e `excluir_carregamento`; publicá-lo antes das
migrations causa erro nessas operações.

## Verificação

- `supabase/tests/carregamento_gravacao_integracoes.sql` cobre idempotência, rollback
  integral, sequência de números, dados controlados pelo servidor, exclusão com
  auditoria, bloqueio de solicitação movimentada e negativa por permissão.
- O teste SQL termina com `ROLLBACK`.
- Os cenários SQL foram executados em PostgreSQL isolado (PGlite), com estrutura mínima.
- Testes dos serviços conferem que criação, exclusão e cotação propagam falhas.

## Próxima etapa

Revisão das políticas de acesso do módulo, proteção do histórico, permissões das
transportadoras e publicação em tempo real dos alertas.
