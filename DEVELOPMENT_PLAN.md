# FertCalc Pro — Plano de Desenvolvimento

## Visão Geral
FertCalc Pro é uma aplicação web SaaS B2B para o agronegócio, especializada em precificação e formulação de fertilizantes. Construída com React + TypeScript + Supabase + Tailwind CSS v4.

Este plano foi atualizado com base em análise técnica completa realizada em 07/04/2026, cobrindo segurança, qualidade de código, performance, testes e infraestrutura.

---

## 🔴 FASE 0 — Segurança Crítica (Bloqueante)
> Prioridade máxima. Esses problemas expõem dados de usuários e devem ser resolvidos antes de qualquer outra entrega.

### 0.1 Autenticação Segura — Migrar para Supabase Auth
**Problema:** Senhas estão sendo armazenadas e comparadas em texto plano no banco de dados (`db.ts` + `Login.tsx`). Qualquer vazamento do Supabase expõe 100% das credenciais. Além disso, o objeto completo do usuário (incluindo o campo `password`) é salvo no `localStorage`, acessível por qualquer script XSS.

**Tarefas:**
- [ ] Criar usuários no **Supabase Auth** (`supabase.auth.signUp`) preservando o `id` atual como `metadata`
- [ ] Substituir `getUserByEmail` + comparação manual por `supabase.auth.signInWithPassword`
- [ ] Substituir `handleLogout` por `supabase.auth.signOut`
- [ ] Substituir `localStorage.setItem('current_user', ...)` por leitura da sessão via `supabase.auth.getSession()` / `onAuthStateChange`
- [ ] Remover o campo `password` da interface `User` (`types.ts`) e da tabela `app_users`
- [ ] Remover a função `requestPasswordReset` simulada — usar o reset nativo do Supabase Auth (`supabase.auth.resetPasswordForEmail`)
- [ ] Implementar recuperação de senha real com e-mail transacional (via Supabase Auth template)

**Arquivos afetados:** `src/types.ts`, `src/services/db.ts`, `src/services/supabase.ts`, `src/components/Login.tsx`, `src/App.tsx`

---

### 0.2 Row Level Security (RLS) no Supabase
**Problema:** Sem RLS ativado e revisado, qualquer usuário com a `anon key` pode ler e escrever dados de outros usuários diretamente pela API REST do Supabase, contornando completamente a lógica de permissões do frontend.

**Tarefas:**
- [ ] Auditar todas as tabelas no Supabase e verificar quais têm RLS desabilitado
- [ ] Ativar RLS em todas as tabelas de negócio (`clients`, `agents`, `pricing_records`, `goals`, `notifications`, `price_lists`, `app_users`, etc.)
- [ ] Criar políticas por tabela:
  - `app_users`: apenas leitura do próprio registro; admin/master podem ler todos
  - `pricing_records`: usuário vê apenas os seus; manager vê dos seus subordinados; admin/master veem todos
  - `notifications`: usuário vê apenas as suas ou as globais (`user_id IS NULL`)
  - `goals`: idem `pricing_records`
  - `clients`, `agents`, `branches`, `price_lists`: acesso baseado em role
- [ ] Testar políticas com usuário `anon` e usuário autenticado sem role de admin
- [ ] Documentar as políticas no `supabase/` do repositório

**Arquivos afetados:** Supabase Dashboard + `supabase/migrations/`

---

## 🟠 FASE 1 — Estabilização e Qualidade de Código
> Problemas que causam erros silenciosos, dívida técnica acumulada e dificultam manutenção.

### 1.1 Corrigir Erros TypeScript Existentes
**Problema:** `npm run lint` (tsc --noEmit) falha com 4 erros em produção.

**Tarefas:**
- [ ] `ManagementReportsModule.tsx:1641` — Corrigir comparação de tipos incompatíveis (`'indicadores' | 'categorias' | ...` vs `'unidades'`): adicionar `'unidades'` à union type do estado de tab
- [ ] `useCalculatorFormulas.ts:2` — Corrigir import do `javascript-lp-solver`: mudar de `import { Solver }` para `import Solver from 'javascript-lp-solver'`
- [ ] `__tests__/CalculatorSettingsModal.test.tsx` — Instalar `vitest` e `@testing-library/react` como devDependencies (ver seção 1.3)
- [ ] Configurar `tsconfig.json` com `"strict": true` gradualmente (começar com `"noImplicitAny": true`)

**Arquivos afetados:** `src/components/ManagementReportsModule.tsx`, `src/hooks/useCalculatorFormulas.ts`, `tsconfig.json`, `package.json`

---

### 1.2 Instalar e Configurar ESLint + Prettier
**Problema:** Sem linter configurado, padrões de código inconsistentes se acumulam silenciosamente. Atualmente há 200 usos de `any` e 70 `console.log` em produção.

**Tarefas:**
- [ ] Instalar dependências: `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier`, `eslint-config-prettier`
- [ ] Criar `.eslintrc.json` com regras:
  - `@typescript-eslint/no-explicit-any: warn` (não bloquear inicialmente — reduzir gradualmente)
  - `no-console: warn` (avisar sobre console.log)
  - `react-hooks/rules-of-hooks: error`
  - `react-hooks/exhaustive-deps: warn`
  - `jsx-a11y/aria-props: error` (acessibilidade básica)
- [ ] Criar `.prettierrc` com configuração padrão (singleQuote, semi, tabWidth: 2)
- [ ] Adicionar script `"lint:fix": "eslint src --ext .ts,.tsx --fix"` no `package.json`
- [ ] Instalar `husky` + `lint-staged`: bloquear commits que introduzam novos erros de lint
- [ ] Executar `lint:fix` e corrigir todos os erros (não apenas warnings) manualmente

**Arquivos afetados:** `package.json`, `.eslintrc.json` (novo), `.prettierrc` (novo), `.husky/` (novo)

---

### 1.3 Configurar Testes Automatizados
**Problema:** Apenas 1 arquivo de teste existe e ele não funciona (dependências não instaladas). O núcleo de negócio (`calculateSummary`, `calculateFormula`) não tem nenhuma cobertura.

**Tarefas:**
- [ ] Instalar: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitest/coverage-v8`
- [ ] Configurar `vitest.config.ts` com `environment: 'jsdom'` e setup de `@testing-library/jest-dom`
- [ ] Adicionar scripts no `package.json`: `"test": "vitest"`, `"test:coverage": "vitest run --coverage"`
- [ ] Corrigir e expandir `CalculatorSettingsModal.test.tsx` existente
- [ ] Escrever testes unitários para `calculateSummary` (`src/utils/calculationUtils.ts`):
  - Caso base: fórmula simples com 1 macro
  - Caso com múltiplos materiais e micronutrientes
  - Caso com fator de custo diferente de 1
  - Caso com todos os fatores de preço (juros, imposto, comissão, frete, margem)
  - Edge cases: peso total zero, fator zero
- [ ] Escrever testes unitários para `buildSolverModel` e `applyResultsToMaterials`
- [ ] Escrever testes para funções utilitárias em `src/utils/formatters.ts` e `src/utils/rentabilityUtils.ts`
- [ ] Meta mínima: **80% de cobertura** nas funções de `src/utils/`
- [ ] Adicionar execução de testes no CI (ver Fase 4)

**Arquivos afetados:** `package.json`, `vitest.config.ts` (novo), `src/utils/*.test.ts` (novos), `src/components/__tests__/`

---

### 1.4 Remover console.log de Produção
**Problema:** 70 statements de `console.log/error/warn` espalhados pelo código. Em produção, poluem o DevTools do usuário e podem vazar informações internas.

**Tarefas:**
- [ ] Criar utilitário `src/utils/logger.ts` com wrapper condicional:
  ```typescript
  const isDev = import.meta.env.DEV;
  export const logger = {
    log: (...args: any[]) => isDev && console.log(...args),
    warn: (...args: any[]) => isDev && console.warn(...args),
    error: (...args: any[]) => console.error(...args), // erros reais sempre logam
  };
  ```
- [ ] Substituir todos os `console.log` por `logger.log` nos arquivos com maior ocorrência: `ManagementReportsModule.tsx` (15), `src/services/db.ts` (3), `Calculator.tsx` (2), `App.tsx` (2)
- [ ] Configurar ESLint para proibir `console.log` direto (`no-console: error`) após migração
- [ ] Verificar que nenhum dado sensível (tokens, senhas, objetos de usuário) aparece nos logs

**Arquivos afetados:** `src/utils/logger.ts` (novo), todos os arquivos com `console.log`

---

## 🟡 FASE 2 — UX e Feedback Visual
> Problemas que degradam a experiência do usuário final e criam fricção no uso diário.

### 2.1 Substituir `alert()`, `confirm()` e `prompt()` Nativos
**Problema:** 30+ chamadas a funções nativas do browser em 12 componentes diferentes. São bloqueantes, não estilizáveis, incompatíveis com tema visual e quebram a UX em dispositivos móveis.

**Tarefas:**
- [ ] Criar componente `src/components/ui/ConfirmDialog.tsx`:
  - Props: `isOpen`, `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `variant` ('danger' | 'warning' | 'info')
  - Animação de entrada/saída com Framer Motion (já instalado)
  - Foco gerenciado (acessibilidade): foco no botão de confirmação ao abrir
- [ ] Criar componente `src/components/ui/PromptDialog.tsx`:
  - Props: `isOpen`, `title`, `defaultValue`, `placeholder`, `onConfirm`, `onCancel`
  - Usado especificamente para o `prompt()` de salvar Batida Salva em `Calculator.tsx`
- [ ] Criar hook `src/hooks/useConfirm.ts` para uso imperativo:
  ```typescript
  const { confirm } = useConfirm();
  const ok = await confirm({ title: '...', message: '...' });
  ```
- [ ] Substituir todas as 30 ocorrências em ordem de impacto:
  1. `Calculator.tsx` — `alert`, `prompt`, `confirm` (3 ocorrências)
  2. `History.tsx` — 3 `confirm`
  3. `ManagementReportsModule.tsx` — 7 `confirm` + 1 `prompt`
  4. `Approvals.tsx` — 3 `confirm`
  5. `AgentManager.tsx`, `ClientManager.tsx`, `BranchManager.tsx`, `BrandManager.tsx` — 1 `confirm` cada
  6. `Goals.tsx`, `IncompatibilityManager.tsx`, `PriceListManager.tsx`, `PricingDetailModal.tsx` — 1 `confirm` cada
  7. `FertigranPComparisonModal.tsx` — 4 `alert`
  8. `CompatibilityCategoryManager.tsx`, `ExpenseCategoryManager.tsx` — 1 `confirm` cada

**Arquivos afetados:** `src/components/ui/ConfirmDialog.tsx` (novo), `src/hooks/useConfirm.ts` (novo), 12 componentes

---

### 2.2 Loading States e Feedback de Ações
**Problema:** Operações assíncronas (salvar precificação, carregar lista, deletar cliente) não fornecem feedback visual durante a espera, deixando o usuário sem saber se a ação foi registrada.

**Tarefas:**
- [ ] Criar componente `src/components/ui/Spinner.tsx` reutilizável (sizes: sm, md, lg)
- [ ] Adicionar estado `isLoading` nos formulários de criação/edição dos managers: `ClientManager`, `AgentManager`, `BranchManager`, `UserManager`, `PriceListManager`
- [ ] Desabilitar botões de submit durante carregamento (`disabled={isLoading}`)
- [ ] Adicionar skeleton loading nas listas ao inicializar (substituir tela vazia por placeholders animados)
- [ ] Garantir que o `Toast` component já existente seja usado consistentemente para confirmar ações de sucesso (ex: "Cliente salvo com sucesso!")

**Arquivos afetados:** `src/components/ui/Spinner.tsx` (novo), múltiplos managers

---

### 2.3 Validação de Formulários
**Problema:** Formulários críticos (como salvar precificação) não validam campos obrigatórios antes de chamar o banco, resultando em erros silenciosos ou entradas inválidas.

**Tarefas:**
- [ ] Validar em `Calculator.tsx` antes de salvar:
  - Pelo menos uma fórmula selecionada
  - Cliente e Agente preenchidos
  - Lista de preços e filial selecionados
  - Pelo menos 1 material com quantidade > 0
- [ ] Validar CPF/CNPJ no `ClientManager.tsx` (verificar dígitos verificadores)
- [ ] Mostrar mensagens de erro inline abaixo dos campos (não apenas via `alert`)
- [ ] Bloquear submissão do formulário enquanto há campos inválidos

**Arquivos afetados:** `src/components/Calculator.tsx`, `src/components/ClientManager.tsx`, `src/components/AgentManager.tsx`

---

### 2.4 Acessibilidade (A11y)
**Problema:** Botões de ícone sem `aria-label` são invisíveis para leitores de tela. Dropdowns não suportam navegação por teclado.

**Tarefas:**
- [ ] Adicionar `aria-label` descritivo em todos os botões que usam apenas ícone (Trash2, X, Edit, Plus, etc.) — buscar padrão `<button>` sem texto visível
- [ ] Garantir `role="dialog"` e `aria-modal="true"` nos modais
- [ ] Adicionar `aria-live="polite"` na área de notificações Toast
- [ ] Testar navegação por teclado no dropdown de seleção de cliente/agente na calculadora
- [ ] Garantir contraste de cores adequado (WCAG AA) nos textos em fundo verde/emerald

**Arquivos afetados:** `Sidebar.tsx`, `Calculator.tsx`, modais em geral

---

## 🟢 FASE 3 — Performance e Escalabilidade
> Problemas que se tornam críticos com crescimento do volume de dados.

### 3.1 Paginação nas Consultas ao Banco
**Problema:** Todas as queries principais carregam **todos** os registros de uma vez (`SELECT * FROM clients`, `SELECT * FROM pricing_records`, etc.). Com centenas de clientes ou milhares de precificações, isso causará lentidão e timeout.

**Tarefas:**
- [ ] Adicionar função genérica de paginação em `db.ts`:
  ```typescript
  interface PaginatedResult<T> { data: T[]; count: number; }
  async function paginate<T>(query, page: number, pageSize: number): Promise<PaginatedResult<T>>
  ```
- [ ] Implementar paginação em `getPricingRecords` (tabela mais crítica — pode ter milhares de linhas):
  - Parâmetros: `page`, `pageSize` (default 20), `filters`
  - Retornar total de registros para controle de paginação
- [ ] Implementar paginação em `getClients` e `getAgents` (com busca server-side por nome/código)
- [ ] Implementar paginação em `getNotifications` (limitar a 50 mais recentes)
- [ ] Atualizar `History.tsx` para usar paginação com controles "Anterior / Próximo"
- [ ] Atualizar `ClientManager.tsx` e `AgentManager.tsx` para busca incremental (debounce de 300ms)

**Arquivos afetados:** `src/services/db.ts`, `src/components/History.tsx`, `src/components/ClientManager.tsx`, `src/components/AgentManager.tsx`

---

### 3.2 Otimizações de Re-render no React
**Problema:** Recálculos desnecessários a cada render em `App.tsx` e componentes pesados.

**Tarefas:**
- [ ] `App.tsx`: substituir `const isStandalone = searchParams.get('standalone') === 'true'` por `useMemo`
- [ ] `App.tsx`: memoizar a lista de `navItems` com `useMemo` (depende de `activeModule` e `currentUser.role`)
- [ ] `Calculator.tsx`: envolver `calculateSummary` em `useCallback` com deps corretas
- [ ] `Calculator.tsx`: memoizar a lista filtrada de materiais com `useMemo`
- [ ] Adicionar `React.memo` nos itens de lista de alta frequência (linhas de histórico, itens de notificação)
- [ ] Avaliar uso de `useTransition` para operações pesadas de filtragem/ordenação

**Arquivos afetados:** `src/App.tsx`, `src/components/Calculator.tsx`

---

### 3.3 Reduzir Uso de `any` no TypeScript
**Problema:** 200 usos de `any` anulam os benefícios do TypeScript e mascaram bugs em tempo de compilação.

**Tarefas:**
- [ ] Gerar tipos automáticos do schema Supabase com `supabase gen types typescript` e salvar em `src/types/database.types.ts`
- [ ] Substituir `any` nas funções `mapUser`, `mapClient`, `mapAgent` em `db.ts` pelos tipos gerados
- [ ] Substituir `any` nos handlers de evento React (`e: any` → `e: React.ChangeEvent<HTMLInputElement>`)
- [ ] Substituir `any` nos payloads de update em `db.ts` por tipos parciais explícitos
- [ ] Configurar `@typescript-eslint/no-explicit-any: error` após reduzir para < 20 ocorrências
- [ ] Meta: zero `any` explícito em `src/utils/` e `src/services/`

**Arquivos afetados:** `src/services/db.ts`, `src/types/database.types.ts` (novo), múltiplos componentes

---

## 🔵 FASE 4 — Infraestrutura e DevOps
> Automatização, confiabilidade e processos de desenvolvimento profissionais.

### 4.1 CI/CD com GitHub Actions
**Problema:** Sem pipeline automatizado, qualquer erro de build ou tipo pode entrar em produção sem detecção.

**Tarefas:**
- [ ] Criar `.github/workflows/ci.yml`:
  ```yaml
  # Disparado em: push para main + pull requests
  jobs:
    quality:
      - checkout
      - node setup (versão 20)
      - npm ci
      - npm run lint          # tsc --noEmit
      - npx eslint src        # ESLint
      - npm test -- --run     # Vitest (sem watch)
    build:
      - npm run build         # Vite build
      needs: [quality]
  ```
- [ ] Criar `.github/workflows/deploy.yml`:
  - Disparado apenas em push para `main`
  - Deploy automático para Vercel (via `vercel --prod`) após CI verde
  - Secrets configurados: `VERCEL_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Adicionar badge de CI no README

**Arquivos afetados:** `.github/workflows/ci.yml` (novo), `.github/workflows/deploy.yml` (novo)

---

### 4.2 Documentação e Setup Local
**Problema:** O README atual tem apenas 3 linhas de instrução, insuficiente para onboarding de novos desenvolvedores.

**Tarefas:**
- [ ] Reescrever `README.md` com:
  - Descrição do produto e stack
  - Pré-requisitos (Node 20+, conta Supabase)
  - Setup passo a passo (clonar, `.env.local`, `npm install`, `npm run dev`)
  - Estrutura de pastas comentada
  - Comandos disponíveis (`dev`, `build`, `lint`, `test`, `test:coverage`)
  - Guia de contribuição (branches, commits, PRs)
  - Link para o plano de desenvolvimento
- [ ] Documentar todas as variáveis de ambiente no `.env.example` com descrição
- [ ] Criar `supabase/README.md` com instrução para aplicar migrations e configurar RLS

**Arquivos afetados:** `README.md`, `.env.example`, `supabase/README.md` (novo)

---

### 4.3 Logs de Auditoria para Ações Críticas
**Problema:** Ações irreversíveis (aprovação de precificação, exclusão, transferência) não geram registro imutável de auditoria além do `history` do próprio registro.

**Tarefas:**
- [ ] Criar tabela `audit_logs` no Supabase:
  ```sql
  CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'pricing.approved', 'pricing.deleted', etc.
    entity_type TEXT NOT NULL,     -- 'pricing_record', 'goal', 'user'
    entity_id TEXT NOT NULL,
    metadata JSONB,                -- dados relevantes no momento da ação
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- [ ] Criar `src/services/auditService.ts` com função `logAudit(action, entity_type, entity_id, metadata)`
- [ ] Inserir log nas ações: aprovação/reprovação de precificação, exclusão de precificação, transferência, aprovação/reprovação de meta
- [ ] RLS: `audit_logs` — apenas INSERT para autenticados; SELECT apenas para admin/master

**Arquivos afetados:** `supabase/migrations/` (novo), `src/services/auditService.ts` (novo), `Approvals.tsx`, `History.tsx`

---

## 🟣 FASE 5 — Refatoração de Componentes Grandes
> Reduzir complexidade dos "God Components" para facilitar manutenção futura.

### 5.1 Quebrar `ManagementReportsModule.tsx` (2.552 linhas)
**Problema:** Um único arquivo com 2.552 linhas combina pelo menos 6 responsabilidades distintas.

**Plano de extração:**
- [ ] `src/components/management/ManagementDashboard.tsx` — Capa / relatório visual
- [ ] `src/components/management/ManagementLancamentos.tsx` — Lançamentos de indicadores
- [ ] `src/components/management/ManagementCadastros.tsx` — CRUD de unidades, indicadores, categorias
- [ ] `src/components/management/ManagementMetas.tsx` — Metas por unidade/mês
- [ ] `src/hooks/useManagementData.ts` — Toda a lógica de fetch/estado
- [ ] `src/utils/managementCalculations.ts` — Cálculos de atingimento e projeções
- [ ] `ManagementReportsModule.tsx` se torna um orquestrador com < 100 linhas

---

### 5.2 Quebrar `Calculator.tsx` (1.599 linhas)
**Problema:** A calculadora mistura lógica de negócio, estado complexo, LP Solver e JSX de múltiplos painéis em um único componente.

**Plano de extração:**
- [ ] `src/hooks/useCalculator.ts` — Estado global da calculadora (materiais, fórmulas, fatores)
- [ ] `src/hooks/useLPSolver.ts` — Integração com `javascript-lp-solver`, isolando a lógica de otimização
- [ ] `src/components/calculator/MaterialsPanel.tsx` — Painel de seleção de macros/micros
- [ ] `src/components/calculator/FormulaPanel.tsx` — Painel de fórmulas alvo e resultados NPK
- [ ] `src/components/calculator/PricingFactorsPanel.tsx` — Painel de fatores (frete, juros, comissão etc.)
- [ ] `src/components/calculator/PricingSummaryPanel.tsx` — Painel de resumo final de preço
- [ ] `Calculator.tsx` se torna orquestrador com < 150 linhas

---

### 5.3 Extrair Lógica de Negócio do `App.tsx`
**Problema:** `App.tsx` (34KB) acumula: roteamento, sidebar, módulos, notificações, timer de inatividade e PWA install.

**Plano de extração:**
- [ ] `src/hooks/useInactivityTimer.ts` — Lógica de timeout por inatividade
- [ ] `src/hooks/usePWAInstall.ts` — Lógica de `beforeinstallprompt`
- [ ] `src/components/layout/Sidebar.tsx` — Refatorar o Sidebar existente para receber `navItems` como prop
- [ ] `src/components/layout/AppShell.tsx` — Layout principal (sidebar + topbar + conteúdo)
- [ ] `App.tsx` se torna apenas o provider de rotas + autenticação com < 80 linhas

---

## 📋 Resumo de Prioridades e Estimativas

| Fase | Foco | Prioridade | Esforço Estimado |
|------|------|-----------|-----------------|
| **0.1** | Autenticação segura (Supabase Auth) | 🔴 Crítico | 3–4 dias |
| **0.2** | Row Level Security (RLS) | 🔴 Crítico | 2–3 dias |
| **1.1** | Corrigir erros TypeScript | 🟠 Alto | 1 dia |
| **1.2** | ESLint + Prettier + Husky | 🟠 Alto | 1 dia |
| **1.3** | Testes automatizados (Vitest) | 🟠 Alto | 3–4 dias |
| **1.4** | Remover console.log de produção | 🟠 Alto | 0,5 dia |
| **2.1** | Substituir alert/confirm/prompt nativos | 🟡 Médio | 2–3 dias |
| **2.2** | Loading states e feedback visual | 🟡 Médio | 1–2 dias |
| **2.3** | Validação de formulários | 🟡 Médio | 1–2 dias |
| **2.4** | Acessibilidade (aria-labels, keyboard nav) | 🟡 Médio | 1 dia |
| **3.1** | Paginação nas queries | 🟡 Médio | 2–3 dias |
| **3.2** | Otimizações de re-render | 🟢 Baixo | 1 dia |
| **3.3** | Reduzir uso de `any` | 🟢 Baixo | 2 dias |
| **4.1** | CI/CD com GitHub Actions | 🟡 Médio | 1 dia |
| **4.2** | Documentação e README | 🟢 Baixo | 0,5 dia |
| **4.3** | Logs de auditoria | 🟢 Baixo | 1–2 dias |
| **5.1** | Refatorar ManagementReportsModule | 🟢 Baixo | 3–4 dias |
| **5.2** | Refatorar Calculator | 🟢 Baixo | 3–4 dias |
| **5.3** | Refatorar App.tsx | 🟢 Baixo | 1–2 dias |

**Total estimado: 30–45 dias de desenvolvimento (considerando 1 desenvolvedor)**

---

## ✅ Critérios de Conclusão de Fase

Cada fase só é considerada concluída quando:
1. Todas as tarefas estão marcadas como `[x]`
2. `npm run lint` passa sem erros
3. `npm test -- --run` passa sem falhas
4. `npm run build` gera bundle sem warnings críticos
5. Pull Request aprovado e merge realizado na branch `main`

---

## Convenções de Branch

| Tipo | Padrão |
|------|--------|
| Correção de bug | `fix/descricao-curta` |
| Nova feature | `feat/descricao-curta` |
| Refatoração | `refactor/descricao-curta` |
| Hotfix urgente | `hotfix/descricao-curta` |
| Segurança | `security/descricao-curta` |

## Convenções de Commit

Seguir [Conventional Commits](https://www.conventionalcommits.org/):
- `fix:` correção de bug
- `feat:` nova funcionalidade
- `refactor:` refatoração sem mudança de comportamento
- `chore:` tarefas de manutenção (deps, config)
- `docs:` documentação
- `security:` correção de vulnerabilidade
- `test:` adição ou correção de testes
- `perf:` melhoria de performance
