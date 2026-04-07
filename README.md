# FertCalc Pro 🌱

> Calculadora de preço de venda de fertilizantes com gestão de matérias-primas, histórico de precificação e relatórios gerenciais personalizáveis.

[![CI](https://github.com/your-org/fertcalc-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fertcalc-pro/actions/workflows/ci.yml)

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack Técnica](#stack-técnica)
- [Pré-requisitos](#pré-requisitos)
- [Instalação local](#instalação-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Banco de dados (Supabase)](#banco-de-dados-supabase)
- [Contribuindo](#contribuindo)
- [Convenções de commit](#convenções-de-commit)

---

## Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Calculadora NPK** | Motor LP Solver para otimizar composição de fertilizantes |
| **Precificação** | Fatores de custo, margem, frete, juros, comissão e desconto |
| **Workflow de aprovação** | Fluxo `Vendedor → Manager → Admin` com notificações |
| **Histórico** | Registro completo de precificações com diff de alterações |
| **Relatórios Gerenciais** | KPIs configuráveis por unidade com metas mensais |
| **Gestão de cadastros** | Clientes, agentes, filiais, marcas, listas de preço |
| **Despesas de cartão** | Lançamento, conferência e aprovação de gastos |
| **PWA** | Instalável no dispositivo, funciona offline (cache de shell) |

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript 5.8 |
| Build | Vite 6 |
| Estilo | Tailwind CSS v4 |
| Roteamento | React Router v7 |
| Estado global | Zustand |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Relatórios | jsPDF + jspdf-autotable, xlsx |
| Otimização LP | javascript-lp-solver |
| Gráficos | Recharts |
| Animações | Framer Motion |
| Testes | Vitest + @testing-library/react |
| Lint | ESLint + Prettier + Husky |

---

## Pré-requisitos

- **Node.js** ≥ 20 LTS
- **npm** ≥ 10
- Conta no **Supabase** (gratuita)

---

## Instalação local

```bash
# 1. Clone o repositório
git clone https://github.com/your-org/fertcalc-pro.git
cd fertcalc-pro

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:5173** no navegador.

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase (ex: `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave anônima pública do Supabase |
| `GEMINI_API_KEY` | ⬜ | Chave da API Google Gemini (funcionalidades de IA) |
| `APP_URL` | ⬜ | URL pública da aplicação (usado em e-mails) |

> ⚠️ Nunca commite o arquivo `.env.local`. Ele já está no `.gitignore`.

---

## Scripts disponíveis

```bash
npm run dev          # Servidor de desenvolvimento (HMR)
npm run build        # Build de produção para /dist
npm run preview      # Pré-visualização do build
npm run lint         # Verificação de tipos TypeScript
npm run test         # Testes em modo watch
npm run test:run     # Testes em modo CI (sem watch)
npm run test:coverage # Cobertura de código
npm run clean        # Remove a pasta /dist
```

---

## Estrutura do projeto

```
src/
├── components/          # Componentes React
│   ├── ui/              # Componentes genéricos (ConfirmDialog, Spinner…)
│   ├── ExpenseManagement/  # Módulo de despesas
│   └── notifications/   # Sistema de notificações
├── hooks/               # Custom hooks
│   ├── useConfirm.ts    # Diálogos de confirmação assíncronos
│   ├── useInactivityTimer.ts  # Logout automático por inatividade
│   └── usePWAInstall.ts # Prompt de instalação PWA
├── services/
│   ├── authService.ts   # Autenticação via Supabase Auth
│   ├── db.ts            # CRUD principal
│   └── notificationService.ts
├── utils/
│   ├── logger.ts        # Logger com controle de ambiente
│   ├── calculationUtils.ts  # Funções de cálculo NPK
│   └── pdfGenerator.ts
├── types.ts             # Tipos globais
└── App.tsx              # Componente raiz + roteamento
supabase/
└── migrations/          # Migrações SQL (RLS, audit_logs…)
.github/
└── workflows/
    └── ci.yml           # Pipeline CI (lint + test + build)
```

---

## Banco de dados (Supabase)

### Aplicar migrações

```bash
# Instale o CLI do Supabase
npm install -g supabase

# Login
supabase login

# Vincule ao projeto
supabase link --project-ref <seu-project-ref>

# Aplique as migrações
supabase db push
```

### Row Level Security (RLS)

Todas as tabelas de negócio possuem RLS habilitado. As políticas estão em:
- `supabase/migrations/20260407000000_rls_all_tables.sql`

### Auditoria

Ações críticas (criação/exclusão de usuários, aprovações) são registradas em `audit_logs`:
- `supabase/migrations/20260407000001_audit_logs.sql`

---

## Contribuindo

1. Crie um branch a partir de `main`:
   ```bash
   git checkout -b feat/minha-feature
   ```
2. Faça suas alterações seguindo as convenções abaixo
3. Verifique lint e testes:
   ```bash
   npm run lint && npm run test:run
   ```
4. Abra um Pull Request para `main`

---

## Convenções de commit

Este projeto segue o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     nova funcionalidade
fix:      correção de bug
refactor: refatoração sem mudança de comportamento
chore:    manutenção (deps, configs)
docs:     documentação
test:     adição ou correção de testes
```

**Exemplos:**
```bash
git commit -m "feat: adicionar exportação de relatório em Excel"
git commit -m "fix: corrigir cálculo de rentabilidade com juros compostos"
git commit -m "refactor: extrair useInactivityTimer de App.tsx"
```

---

## Licença

Proprietário — todos os direitos reservados.
