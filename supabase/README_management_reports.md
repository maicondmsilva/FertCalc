# Módulo Relatórios Gerenciais — Migração para Supabase

## Visão Geral

O módulo **Relatórios Gerenciais** foi migrado de um servidor Express.js + SQLite local para usar o **Supabase** diretamente, alinhando-o com o restante da aplicação e garantindo compatibilidade com a hospedagem na **Vercel** (serverless).

## Tabelas necessárias

Antes de fazer o deploy ou usar o módulo em produção, é necessário criar as tabelas no Supabase executando o arquivo SQL de migração.

## Como executar a migração

### Opção 1 — Painel do Supabase (recomendado)

1. Acesse o [painel do Supabase](https://app.supabase.com) e selecione o seu projeto.
2. Vá em **SQL Editor** no menu lateral.
3. Copie e cole o conteúdo do arquivo [`supabase/migrations/management_reports.sql`](./migrations/management_reports.sql).
4. Clique em **Run** para executar.

### Opção 2 — Supabase CLI

```bash
supabase db push
```

## Tabelas criadas

| Tabela | Descrição |
|--------|-----------|
| `management_unidades` | Unidades de negócio |
| `management_categorias` | Categorias de indicadores |
| `management_indicadores` | Indicadores de desempenho |
| `management_lancamentos` | Lançamentos diários de valores |
| `management_metas` | Metas mensais por unidade/indicador |
| `management_configuracoes_indicadores` | Personalizações de indicadores por unidade |
| `management_dias_uteis` | Dias úteis por mês e unidade |

## Observações

- As tabelas usam `TEXT` como tipo de chave primária para manter compatibilidade com os IDs gerados pelo frontend.
- A operação de `upsert` (inserir ou atualizar) é usada em todas as escritas, evitando duplicações.
- O servidor Express (`server.ts`) não foi removido e pode continuar sendo usado para desenvolvimento local.
