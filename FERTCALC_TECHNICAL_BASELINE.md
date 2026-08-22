# FertCalc Pro — Baseline técnico

Data da coleta: 22/08/2026

Commit de referência: `3a8862002ec417c74c83a820e29eea0945399113` (`main`)

Escopo: Fase 0 do Plano Mestre de Melhorias

Regra desta fase: registrar o estado atual sem alterar comportamento da aplicação.

## 1. Resumo executivo

O FertCalc é uma aplicação React/TypeScript integrada ao Supabase, com autenticação, banco PostgreSQL, RLS, Edge Functions, notificações, precificação, pedidos, carregamentos, despesas e relatórios gerenciais.

O build de produção é concluído, mas o repositório não está em um estado totalmente saudável:

- o typecheck falha com 23 erros;
- 1 de 81 testes falha;
- o ESLint reporta 613 ocorrências (2 erros e 611 avisos);
- o bundle principal minificado tem aproximadamente 3,35 MB (906,74 kB gzip);
- existem políticas RLS que concedem escrita ampla a qualquer usuário autenticado;
- `app_users` permite que o próprio usuário atualize a própria linha sem proteção por coluna;
- auditoria e notificações aceitam inserções originadas no frontend com validação insuficiente;
- há 51 migrações, com correções posteriores de schema e políticas que dificultam inferir o estado final apenas pela leitura dos arquivos.

Conclusão: a ordem Baseline → Segurança P0 → domínio/arquitetura é adequada. A Fase 1 deve começar antes de novas funcionalidades.

## 2. Ajustes recomendados ao Plano Mestre

O plano está aprovado com estas ressalvas:

1. Testes não devem ficar restritos à Fase 5. Cada fase deve entregar testes correspondentes. A Fase 1 precisa incluir testes negativos de autorização/RLS no mesmo PR de cada correção.
2. Multi-tenant só é prioridade crítica se mais de uma empresa compartilhar a mesma instância. Antes da Fase 2 é necessária uma decisão formal de produto e um inventário de dados que receberão `organization_id`.
3. Alterações de RLS devem ser incrementais e reversíveis. Não se deve reescrever todas as políticas em um único PR.
4. O estado final do banco precisa ser validado em um Supabase local ou ambiente de homologação. Os arquivos de migração, isoladamente, não comprovam o schema implantado.
5. Observabilidade mínima (erros de produção e falhas de deploy) deve começar antes da Fase 8, embora a estrutura completa possa permanecer nessa fase.

## 3. Inventário técnico

### 3.1 Stack

- React 18, TypeScript 5.8 e Vite 6.
- React Router 7 e Zustand 5.
- Tailwind CSS 4 e Framer Motion.
- Supabase JS 2, PostgreSQL, Auth, RLS e Edge Functions.
- `javascript-lp-solver` para otimização.
- Vitest e Testing Library.
- ESLint, Prettier, Husky e lint-staged.
- GitHub Actions para CI, Vercel e deploy de Edge Functions.

### 3.2 Dimensão do código

| Item | Quantidade |
|---|---:|
| Arquivos em `src` | 155 |
| Arquivos TypeScript/TSX | 153 |
| Componentes TSX | 78 |
| Serviços TypeScript | 25 |
| Hooks TypeScript | 21 |
| Arquivos de teste | 13 |
| Migrações Supabase | 51 |
| Edge Functions | 3 |
| Ocorrências textuais de `any` | 165 |
| Chamadas `console.log/warn/error` | 105 |

### 3.3 Maiores pontos de acoplamento

| Arquivo | Tamanho aproximado |
|---|---:|
| `src/components/Carregamento/index.tsx` | 193 kB |
| `src/components/Calculator.tsx` | 112 kB |
| `src/components/Carregamento/SolicitacaoCotacao.tsx` | 110 kB |
| `src/components/management/ManagementCadastros.tsx` | 79 kB |
| `src/components/PricingDetailModal.tsx` | 77 kB |
| `src/components/UserManager.tsx` | 62 kB |
| `src/hooks/useCalculator.ts` | 57 kB |
| `src/services/db.ts` | 56 kB |
| `src/App.tsx` | 47 kB |

Esses arquivos misturam apresentação, estado, autorização, acesso a dados e regras de negócio. Eles são os principais candidatos das Fases 3 e 4, mas não devem ser refatorados durante a Segurança P0 sem necessidade direta.

## 4. Autenticação, usuários e permissões

### Estado atual

- O login e a sessão usam Supabase Auth.
- As operações administrativas usam Edge Functions com `service_role` no servidor.
- Existem níveis legados (`master`, `admin`, `manager`, `user`) e níveis dinâmicos via `access_levels`.
- Permissões adicionais são armazenadas na linha de `app_users`.
- A aplicação possui conceitos de subordinados e filiais permitidas.

### Riscos identificados

1. A política de atualização de `app_users` permite `id = auth.uid()`. RLS opera por linha, não por coluna; assim, sem trigger ou RPC segura, o usuário pode tentar alterar `role`, `permissions`, `managed_user_ids`, filiais e `ativo` em sua própria linha.
2. As funções auxiliares `SECURITY DEFINER` mais antigas não fixam explicitamente um `search_path` seguro.
3. A autorização das Edge Functions verifica papéis, mas precisa ser comparada com a hierarquia dinâmica e com a relação caller/target.
4. Migrações antigas e novas coexistem, podendo representar modelos diferentes de permissões.

## 5. RLS e banco de dados

### Áreas com proteção presente

- `pricing_records`, `saved_formulas`, `goals`, clientes, agentes, filiais, listas de preço e materiais possuem políticas declaradas.
- tabelas de carregamento, pedidos, despesas, notificações, auditoria e relatórios também habilitam RLS em diferentes migrações.

### Achados P0

- `notifications` possui política de INSERT para usuários autenticados sem restringir o destinatário.
- `audit_logs`/`audit_log` aceitam inserção de autenticados, permitindo que o frontend forneça dados de auditoria.
- tabelas de despesas usam políticas `FOR ALL USING (true) WITH CHECK (true)`.
- tabelas de relatórios gerenciais usam políticas `FOR ALL USING (true) WITH CHECK (true)`.
- `cotacoes_frete`, `historico_carregamento` e outras áreas de carregamento possuem políticas amplas para autenticados.
- políticas permissivas de migrações anteriores podem coexistir com políticas posteriores; no PostgreSQL políticas permissivas são combinadas por OR.

### Limitação desta coleta

Não houve acesso ao schema implantado nem execução de testes RLS contra um Supabase local. Portanto, os achados refletem o histórico de migrações versionado e precisam ser confirmados no ambiente de homologação.

## 6. Edge Functions

Funções encontradas:

- `admin-create-user`;
- `admin-update-password`;
- `admin-delete-user`.

Todas precisam ser auditadas na Fase 1 quanto a:

- validação do JWT do chamador;
- papel e hierarquia do chamador;
- proteção do usuário alvo, especialmente `master`;
- validação e normalização do payload;
- atomicidade entre Auth e `app_users`;
- CORS por origem permitida;
- mensagens de erro sem detalhes internos;
- uso exclusivo da `service_role` no servidor.

## 7. Motor de cálculo e fluxos críticos

O motor está distribuído principalmente entre:

- `src/hooks/useCalculator.ts`;
- `src/hooks/useCalculatorFormulas.ts`;
- `src/hooks/usePricingFactors.ts`;
- `src/utils/calculationUtils.ts`;
- `src/utils/calculationMode.ts`;
- componentes da Calculadora;
- persistência em `src/services/db.ts` e serviços específicos.

Fluxos que exigem casos de regressão antes da refatoração:

1. formulação NPK e otimização LP;
2. produto livre/puro e formulado;
3. custo de matérias-primas;
4. embalagem, frete, impostos, juros, comissão, desconto e margem;
5. arredondamento e preço final;
6. salvar e reabrir precificação;
7. aprovação;
8. conversão em pedido;
9. reserva, consumo e devolução de saldo;
10. carregamento CIF/FOB.

## 8. Qualidade automatizada em 22/08/2026

### TypeScript

Status: **falhou — 23 erros**.

Grupos principais:

- React não reconhece `key` em vários componentes, indicando configuração/tipos JSX inconsistentes;
- valores `unknown` usados como números em `PriceListManager`;
- ícone `Search` ausente em `SavedFormulas`;
- status `carregando` incompatível com o tipo de pedido.

### ESLint

Status: **falhou — 613 ocorrências (2 erros e 611 avisos)**.

Categorias dominantes:

- acessibilidade de labels e elementos clicáveis;
- `any` explícito;
- imports e variáveis não utilizados;
- dependências de hooks;
- logs diretos;
- comentários/texto JSX inválidos.

### Testes

Status: **falhou — 80 passaram e 1 falhou, em 13 arquivos**.

Falha:

- `execucaoCarregamentoService.test.ts`: mock do Supabase não implementa a cadeia `.from(...).select(...)` usada por `updateExecucaoStatus`.

### Build

Status: **passou**.

Alertas:

- importação simultaneamente estática e dinâmica de `auditLogService`;
- chunk principal com 3,35 MB minificados (906,74 kB gzip), acima do limite configurado de 2 MB.

## 9. CI/CD

O workflow principal executa typecheck, ESLint, testes e build. Como o baseline local falha em typecheck, lint e teste, é necessário confirmar se a branch `main` está efetivamente protegida por esse workflow e se a execução mais recente apresenta as mesmas falhas.

O deploy usa Vercel e há workflow separado para Edge Functions. O pipeline ainda não inclui:

- testes de integração/RLS;
- análise de dependências;
- varredura de segredos;
- testes E2E;
- preview obrigatório;
- verificação de migrações.

## 10. Dependências e reprodutibilidade

- O projeto declara Node >=20 no README e usa `package-lock.json`.
- A instalação executa `husky` no `prepare`, pressupondo `node` disponível no PATH.
- Foram observados alertas de pacotes descontinuados ou fora de manutenção, incluindo Recharts 2.x.
- Atualizações grandes (React 19, Recharts 3, Vite mais recente) devem ser tratadas em PRs isolados, nunca junto da Segurança P0.

## 11. Backlog inicial aprovado

### Fase 0 — conclusão

- [x] Inventariar arquitetura e dimensões.
- [x] Registrar estado de typecheck, lint, testes e build.
- [x] Mapear autenticação, RLS, Edge Functions e pontos de acoplamento.
- [x] Registrar riscos e limitações da coleta.
- [ ] Confirmar estado do schema implantado em homologação.
- [ ] Confirmar proteção da branch e estado dos workflows no GitHub.

### Fase 1 — ordem sugerida dos PRs

1. **P0.1 — Blindagem de `app_users`**: trigger/RPC, políticas por operação e testes negativos.
2. **P0.2 — Auditoria confiável**: escrita server-side, identidade derivada de `auth.uid()` e imutabilidade.
3. **P0.3 — Notificações confiáveis**: bloquear destinatário arbitrário e centralizar emissão.
4. **P0.4 — Hierarquia centralizada**: helpers SQL únicos e testes de matriz caller/target.
5. **P0.5 — RLS por domínio**: despesas, carregamentos, pedidos, precificação, cadastros e relatórios em PRs separados.
6. **P0.6 — Edge Functions**: autorização hierárquica, payload, atomicidade, CORS e respostas.
7. **P0.7 — Suíte de segurança**: consolidar testes negativos e documentação operacional.

Cada PR deve conter migração reversível, testes, matriz de acesso afetada e instruções de validação em homologação.

## 12. Próxima ação

Após validar este baseline contra o ambiente implantado, iniciar o PR P0.1. Não combinar a blindagem de `app_users` com refatorações de frontend ou novas funcionalidades.

