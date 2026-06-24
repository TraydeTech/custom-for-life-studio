---
tags: [frontend, backend, auth]
---

# Autenticação e Permissões

Fonte: `src/contexts/AuthContext.tsx` + Supabase Auth.

## AuthContext expõe
```ts
session, user, isAdmin, adminChecked
signUp(email, password, fullName)
signIn(email, password) // retorna { error, isAdmin? }
signOut()
```

## Verificação de admin
1. Tenta RPC `supabase.rpc('has_role', { _user_id, _role: 'admin' })`.
2. **Fallback:** query direta em `user_roles` (`role = 'admin'`).
3. Resultado guardado em `isAdmin`; `adminChecked` indica que a checagem terminou.

Usado por `ProtectedAdminRoute` / `AdminRoute` para liberar o [[Painel Admin]].

## Papéis (enum `app_role`)
- `admin`
- `user`

Papéis vivem na tabela **`user_roles`** (separada de `profiles`) — ver [[Supabase - Banco de Dados]].

> [!important] Segurança
> Migrations de 2026-06-21 reforçaram **RLS** e movido a aplicação de preços para o servidor (`security_enforce_prices`, `security_rls_storage_admin`). Não confiar em preço/role vindos do cliente.
