---
tags: [backend, supabase, edge-function]
---

# Supabase — Edge Functions

Em `supabase/functions/`. Config de `verify_jwt` em `supabase/config.toml`.

| Função | `verify_jwt` | Papel |
|--------|:---:|-------|
| **`create-payment`** #edge-function | `false` | cria cobrança no gateway (PIX/Iugu) — ver [[Pagamentos (PIX e Iugu)]] |
| **`check-payment-status`** #edge-function | `false` | consulta status de pagamento |
| **`iugu-webhook`** #edge-function | `false` | recebe webhooks da Iugu (atualiza `orders`/`payment_status`) |
| **`support-ticket`** #edge-function | `false` | cria/gerencia chamado de suporte |
| **`sync-ticket-response`** #edge-function | `false` | sincroniza respostas de chamado |

> [!warning] `verify_jwt = false`
> Essas funções não exigem JWT do Supabase — a autenticação é feita por outros meios (assinatura de webhook, validação interna). Confira a auth de webhook ao mexer (uma migration de segurança de 2026-06-21 tratou disso).
