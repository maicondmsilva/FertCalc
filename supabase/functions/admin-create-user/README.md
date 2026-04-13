# Edge Functions — FertCalc Admin Auth

Supabase Edge Functions que expõem operações administrativas de autenticação (usando a `service_role` key no servidor) sem expô-la ao frontend.

## Funções disponíveis

| Função | Descrição |
|--------|-----------|
| `admin-create-user` | Cria um usuário no Supabase Auth sem disparar e-mail de confirmação |
| `admin-update-password` | Atualiza a senha de qualquer usuário via admin API |

---

## Deploy

### Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e autenticado
- Projeto Supabase vinculado (`supabase link --project-ref <seu-ref>`)

### Comandos

```bash
# Deploy da função de criação de usuário
supabase functions deploy admin-create-user

# Deploy da função de atualização de senha
supabase functions deploy admin-update-password
```

---

## Variáveis de ambiente

As variáveis abaixo são injetadas **automaticamente** pelo runtime do Supabase nas Edge Functions — não é necessário configurá-las manualmente:

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço com privilégios de admin (nunca exposta ao frontend) |

---

## Uso das funções pelo frontend

O frontend (`src/services/authService.ts`) chama estas funções via `fetch`, passando o `access_token` do usuário logado no header `Authorization`. Isso garante que somente usuários autenticados possam invocar as funções.

### `admin-create-user`

**POST** `/functions/v1/admin-create-user`

```json
// Body
{ "email": "usuario@exemplo.com", "password": "senha123" }

// Resposta de sucesso (200)
{ "user_id": "uuid-do-usuario" }

// Resposta de erro (4xx/5xx)
{ "error": "mensagem de erro" }
```

### `admin-update-password`

**POST** `/functions/v1/admin-update-password`

```json
// Body
{ "user_id": "uuid-do-usuario", "new_password": "novaSenha123" }

// Resposta de sucesso (200)
{ "success": true }

// Resposta de erro (4xx/5xx)
{ "error": "mensagem de erro" }
```
