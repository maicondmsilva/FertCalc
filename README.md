# FertCalc Pro 🌱

> SaaS B2B para precificação e formulação de fertilizantes no agronegócio — motor LP Solver, workflow de aprovação e relatórios gerenciais.

[![CI](https://github.com/maicondmsilva/FertCalc/actions/workflows/ci.yml/badge.svg)](https://github.com/maicondmsilva/FertCalc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Sumário

- [Descrição](#descrição)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Setup local](#setup-local)
- [Scripts disponíveis](#scripts-disponíveis)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Deploy](#deploy)
- [Módulos principais](#módulos-principais)
- [Licença](#licença)

---

## Descrição

**FertCalc Pro** é uma plataforma SaaS B2B voltada para empresas do agronegócio que precisam precificar e formular fertilizantes de forma rápida e precisa. O sistema oferece:

- Motor de otimização LP para composição mínima de custo de fertilizantes (NPK)
- Workflow de aprovação de precificações (`Vendedor → Manager → Admin`)
- Histórico completo de precificações com diff de alterações
- Relatórios gerenciais configuráveis com KPIs e metas por unidade
- Gestão de clientes, agentes, filiais, marcas e listas de preço
- Módulo de cotação e carregamento de fretes
- Controle de despesas de cartão corporativo

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript 5.8 |
| Build | Vite 6 |
| Estilo | Tailwind CSS v4 |
| Roteamento | React Router v7 |
| Estado global | Zustand |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Otimização LP | javascript-lp-solver |
| Relatórios | jsPDF + jspdf-autotable, xlsx |
| Gráficos | Recharts |
| Animações | Framer Motion |
| Testes | Vitest + @testing-library/react |
| Lint | ESLint + Prettier + Husky + lint-staged |

---

## Pré-requisitos

- **Node.js** ≥ 20 LTS
- **npm** ≥ 10
- Conta no **[Supabase](https://supabase.com)** (gratuita)
- Conta no **[Vercel](https://vercel.com)** (opcional — apenas para deploy)

---

## Setup local

```bash
# 1. Clone o repositório
git clone https://github.com/maicondmsilva/FertCalc.git
cd FertCalc

# 2. Instale as dependências
npm ci

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:5173** no navegador.

---

## Scripts disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `vite` | Servidor de desenvolvimento com HMR |
| `build` | `vite build` | Build de produção para `/dist` |
| `preview` | `vite preview` | Pré-visualização do build |
| `lint` | `tsc --noEmit` | Verificação de tipos TypeScript |
| `lint:eslint` | `eslint src --ext .ts,.tsx` | Lint com ESLint |
| `test` | `vitest` | Testes em modo watch |
| `test:run` | `vitest run` | Testes em modo CI (sem watch) |
| `test:coverage` | `vitest run --coverage` | Cobertura de código |
| `format` | `prettier --write` | Formata o código com Prettier |

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase (ex: `https://your-project.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave anônima pública do Supabase |

> ⚠️ Nunca commite o arquivo `.env` com credenciais reais — ele já está no `.gitignore`.

---

## Estrutura de pastas

```
src/
├── components/          # Componentes React
│   ├── ui/              # Componentes genéricos (ConfirmDialog, Spinner…)
│   ├── ExpenseManagement/  # Módulo de despesas de cartão
│   └── notifications/   # Sistema de notificações
├── services/
│   ├── authService.ts   # Autenticação via Supabase Auth
│   ├── db.ts            # CRUD principal
│   └── notificationService.ts
├── types/               # Tipos TypeScript (carregamento, etc.)
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
    ├── ci.yml           # Pipeline CI (lint + test + build)
    └── deploy.yml       # Deploy automático para Vercel
```

---

## Deploy

O deploy é feito automaticamente via **GitHub Actions → Vercel** ao fazer push para a branch `main`:

1. O workflow `ci.yml` executa lint, testes e build
2. Após o CI passar, o workflow `deploy.yml` aciona o deploy em produção no Vercel

Para configurar, adicione os seguintes **secrets** no repositório GitHub (`Settings → Secrets and variables → Actions`):

| Secret | Descrição |
|--------|-----------|
| `VERCEL_TOKEN` | Token de acesso da conta Vercel |
| `VERCEL_ORG_ID` | ID da organização no Vercel |
| `VERCEL_PROJECT_ID` | ID do projeto no Vercel |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |

---

## Módulos principais

| Módulo | Descrição |
|--------|-----------|
| **Calculadora NPK** | Motor LP Solver para otimizar composição de fertilizantes |
| **Precificação** | Fatores de custo, margem, frete, juros, comissão e desconto |
| **Histórico** | Registro completo de precificações com diff de alterações |
| **Carregamento** | Programação e acompanhamento de carregamentos de frete |
| **Cotação de Frete** | Solicitação e acompanhamento de cotações independentes |
| **Relatórios Gerenciais** | KPIs configuráveis por unidade com metas mensais |
| **Gestão de Cadastros** | Clientes, agentes, filiais, marcas, listas de preço |
| **Despesas de Cartão** | Lançamento, conferência e aprovação de gastos corporativos |

---

## Licença

MIT © [maicondmsilva](https://github.com/maicondmsilva/FertCalc)

