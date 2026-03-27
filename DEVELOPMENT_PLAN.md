# FertCalc — Plano de Desenvolvimento

## Visão Geral
FertCalc é uma aplicação web de precificação e formulação de fertilizantes, construída com React + TypeScript + Supabase.

---

## 🟥 Fase 1 — Estabilização (Urgente)

### 1.1 Correção de bugs estruturais (ce7e1a9)
- [x] Corrigir JSX malformado em `Calculator.tsx`
- [x] Remover interface `Dummy` não utilizada
- [x] Remover bloco `</select>` órfão
- [x] Remover `)}` solto no painel de fatores expandido

### 1.2 Qualidade de código
- [ ] Adicionar ESLint + regras para React/TypeScript
- [ ] Configurar Prettier para padronização de formatação
- [ ] Adicionar husky + lint-staged para bloquear commits com erros

### 1.3 Testes
- [ ] Configurar Vitest ou Jest
- [ ] Escrever testes unitários para `calculateSummary`
- [ ] Escrever testes unitários para `calculateFormula`
- [ ] Escrever testes de integração para o fluxo de salvar precificação

---

## 🟨 Fase 2 — Melhorias de Performance e UX

### 2.1 Performance
- [ ] Substituir `isStandalone` no `App.tsx` por `useMemo`
- [ ] Memoizar `calculateSummary` com `useCallback`
- [ ] Paginar listas grandes de clientes e agentes (atualmente carrega tudo)

### 2.2 Validação e feedback
- [ ] Substituir `alert()` e `confirm()` nativos por modais React customizados
- [ ] Adicionar validação de formulário antes de salvar precificação (ex: fórmula vazia)
- [ ] Mostrar loading states ao salvar/carregar dados

### 2.3 Acessibilidade
- [ ] Adicionar `aria-label` nos botões de ícone (Trash2, X, etc.)
- [ ] Garantir navegação por teclado nos dropdowns de cliente/agente

---

## 🟩 Fase 3 — Novas Funcionalidades

### 3.1 Relatórios
- [ ] Exportar precificação para PDF (melhorar layout atual)
- [ ] Exportar lista de fórmulas para Excel/CSV
- [ ] Dashboard de histórico de precificações por cliente

### 3.2 Comparação de fórmulas
- [ ] Comparação lado a lado de múltiplas fórmulas (N-P-K + custo)
- [ ] Gráfico de composição de matérias-primas (pizza/barra)

### 3.3 Gestão de materiais
- [ ] CRUD completo de matérias-primas na interface admin
- [ ] Histórico de alterações de preços por material
- [ ] Alerta quando preço de material estiver desatualizado (ex: > 30 dias)

### 3.4 Integração e automação
- [ ] Webhook ou importação automática de listas de preço via planilha
- [ ] Notificações por e-mail além das notificações in-app
- [ ] API pública para integração com ERPs

---

## 🔵 Fase 4 — Infraestrutura e Segurança

- [ ] Adicionar Row Level Security (RLS) revisada no Supabase
- [ ] Logs de auditoria para ações críticas (aprovação, exclusão)
- [ ] CI/CD com GitHub Actions (build + testes + deploy automático)
- [ ] Variáveis de ambiente documentadas no `.env.example`
- [ ] README completo com instruções de setup local

---

## Convenções de Branch

| Tipo | Padrão |
|------|--------|
| Correção de bug | `fix/descricao-curta` |
| Nova feature | `feat/descricao-curta` |
| Refatoração | `refactor/descricao-curta` |
| Hotfix urgente | `hotfix/descricao-curta` |

## Convenções de Commit

Seguir [Conventional Commits](https://www.conventionalcommits.org/):
- `fix:` correção de bug
- `feat:` nova funcionalidade
- `refactor:` refatoração sem mudança de comportamento
- `chore:` tarefas de manutenção (deps, config)
- `docs:` documentação
