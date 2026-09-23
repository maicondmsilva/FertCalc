# Chat interno do FertCalc — análise de viabilidade e plano técnico

## Decisão

O chat interno é viável com a arquitetura atual. O FertCalc já possui autenticação,
organização, usuários, permissões, notificações e conexão Supabase Realtime. A
recomendação é criar um módulo próprio de conversas persistentes, em vez de adaptar
a tabela de notificações. Isso mantém leitura, retenção, auditoria e permissões do
chat independentes dos alertas operacionais.

O primeiro lançamento deve ser deliberadamente pequeno: conversas diretas entre
usuários da mesma organização, mensagens de texto, indicador de não lidas e entrega
em tempo real. Grupos, anexos, áudio, edição e exclusão ficam para etapas posteriores.

## Experiência proposta

- Botão de chat no cabeçalho, ao lado das notificações, com contador de mensagens
  não lidas.
- Painel lateral no computador e tela inteira em celulares e tablets.
- Busca por nome, usuário ou perfil; apenas usuários ativos e autorizados da mesma
  organização ficam disponíveis.
- Lista ordenada pela mensagem mais recente, com prévia, horário e quantidade não
  lida.
- Conversa aberta com histórico paginado, envio por Enter e estado de envio.
- Reconexão automática: ao recuperar a conexão, o cliente consulta mensagens novas
  para não depender exclusivamente do evento em tempo real.
- Notificação discreta quando chegar mensagem com o painel fechado. Mensagens do
  chat não devem aparecer como alertas de aprovação ou logística.

## Modelo de dados recomendado

### `chat_conversations`

- `id uuid`
- `organization_id uuid`
- `type text` inicialmente limitado a `direct`
- `direct_key text` único por organização, formado no servidor com os dois usuários
  ordenados, impedindo conversas diretas duplicadas
- `created_by uuid`, `created_at`, `updated_at`, `last_message_at`

### `chat_participants`

- `conversation_id uuid`
- `user_id uuid`
- `organization_id uuid`
- `joined_at`, `last_read_at`, `archived_at`
- chave única por conversa e usuário

### `chat_messages`

- `id uuid`
- `conversation_id uuid`
- `organization_id uuid`
- `sender_id uuid`
- `body text` com limite de tamanho
- `created_at`
- `edited_at` e `deleted_at` reservados para evolução, sem habilitar edição ou
  exclusão na primeira versão

Não é necessária uma tabela por usuário para recibos na primeira versão. O campo
`last_read_at` do participante permite calcular não lidas com menor custo.

## Segurança e hierarquia

- RLS obrigatória em todas as tabelas.
- Um usuário só lê conversa da qual participa e que pertença à sua organização.
- O remetente deve ser sempre `auth.uid()`; o cliente não escolhe outro remetente.
- Participantes não podem trocar `organization_id`, incluir usuários externos nem
  alterar participantes diretamente.
- Criação ou recuperação de conversa direta deve ocorrer por uma RPC transacional.
- Funções devem usar `SECURITY INVOKER` sempre que possível, `search_path` fixo e
  permissão de execução revogada para `public` e `anon`.
- A permissão `chat_access` controla a visibilidade do recurso. Administradores não
  recebem acesso automático ao conteúdo das conversas privadas; uma eventual
  auditoria deve ser desenhada separadamente, com fundamento e trilha de acesso.
- Conteúdo deve ter tamanho máximo, texto vazio deve ser rejeitado e a frequência
  de envio deve ser limitada para evitar abuso.

## Tempo real

Para o volume atual, a primeira versão pode persistir a mensagem em
`chat_messages` e assinar inserções com Postgres Changes. O evento é apenas um
acelerador da interface: o banco continua sendo a fonte da verdade.

A assinatura deve ser desmontada ao fechar a conversa ou sair da conta. Em caso de
`TIMED_OUT`, `CHANNEL_ERROR` ou retorno da conectividade, a aplicação recarrega as
mensagens posteriores à última conhecida. Assim, nenhuma mensagem depende somente
do WebSocket.

Se o volume crescer significativamente, a evolução recomendada é Broadcast privado
por conversa para entrega e tabelas persistentes para histórico. Broadcast público
não deve ser usado.

## Índices e paginação

- índice em `chat_participants (user_id, archived_at, conversation_id)`
- índice em `chat_messages (conversation_id, created_at desc, id desc)`
- índice em `chat_conversations (organization_id, last_message_at desc)`
- paginação por cursor (`created_at`, `id`), nunca carregamento integral do histórico
- contagem de não lidas calculada no banco apenas para as conversas do usuário

## Integração com o FertCalc

- Criar `chat_access` nos perfis e no cadastro de usuários.
- Montar o chat no `AppShell`, mantendo-o disponível durante a troca de módulos.
- Reutilizar padrões de reconexão e estado já empregados pelas notificações, mas
  manter serviços, store e componentes separados.
- Não vincular mensagens diretamente a precificações no MVP. Uma evolução pode
  permitir compartilhar um link interno de precificação, pedido ou carregamento com
  autorização validada ao abrir.
- O chat deve funcionar na PWA atual; isso também reduz retrabalho quando o módulo
  de precificação for empacotado como aplicativo móvel.

## Etapas de implantação

### Fase 4A — Fundação segura

Criar tabelas, índices, RLS, RPC para conversa direta, RPC para envio, paginação e
testes SQL de isolamento entre organizações e participantes.

### Fase 4B — Interface básica

Adicionar botão, contador, painel responsivo, busca de usuários, lista de conversas,
histórico e envio de texto com proteção contra envio duplicado.

### Fase 4C — Tempo real e resiliência

Adicionar assinatura, reconexão, recuperação de mensagens perdidas, marcação de
leitura e testes com múltiplas sessões.

### Fase 4D — Qualidade e operação

Adicionar métricas de falha e latência, limites de uso, política de retenção,
acessibilidade, testes em celular/tablet e liberação gradual por permissão.

## Fora do primeiro lançamento

- anexos, fotos, áudio e vídeo
- grupos e canais por departamento
- edição e exclusão pelo usuário
- presença online e indicador “digitando”
- criptografia ponta a ponta
- leitura administrativa de conversas privadas

Esses recursos elevam custo, risco de privacidade e complexidade de armazenamento.
Devem ser decididos somente após uso real do chat básico.

## Critérios de aceite do MVP

- usuário sem `chat_access` não vê nem acessa o chat
- nenhuma consulta ou evento cruza organizações ou conversas
- duas pessoas possuem apenas uma conversa direta entre si
- duplo clique não cria conversa nem mensagem duplicada
- mensagem persiste antes de aparecer como enviada
- mensagem chega em tempo real e também aparece após reconexão ou atualização
- contador e leitura permanecem corretos em duas sessões simultâneas
- histórico é paginado e o carregamento inicial não cresce com o total de mensagens
- interface funciona em desktop, tablet, celular e PWA

## Recomendação final

Prosseguir com o MVP em quatro entregas pequenas. Não incluir anexos nem grupos na
primeira versão. Essa abordagem aproveita o que o FertCalc já possui, reduz risco de
vazamento entre usuários e permite validar se o chat realmente melhora o fluxo antes
de ampliar o produto.
