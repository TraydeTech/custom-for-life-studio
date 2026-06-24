---
tags: [backend, supabase, tabela, dados]
---

# Supabase — Banco de Dados

- **Project ref:** `ihkbxdayhdewqzezdrfl`
- **URL:** `https://ihkbxdayhdewqzezdrfl.supabase.co`
- **Tipos gerados:** `src/integrations/supabase/types.ts`
- **Cliente:** `src/integrations/supabase/client.ts` (ver [[Variáveis de Ambiente]] e [[Registro de Incidentes]])
- **Migrations:** `supabase/migrations/` (~30 arquivos, jan→jun 2026)

## Tabelas (14)
| Tabela | Conteúdo |
|--------|----------|
| `profiles` #tabela | perfis de usuário |
| `user_roles` #tabela | papéis (admin/user) — base do [[Autenticação e Permissões]] |
| `addresses` #tabela | endereços do cliente |
| `categories` #tabela | categorias de produto |
| `products` #tabela | produtos |
| `product_variants` #tabela | variações (cor/tamanho/etc.) + estoque |
| `cart_items` #tabela | itens de carrinho (usuário logado) |
| `orders` #tabela | pedidos |
| `order_items` #tabela | itens de cada pedido |
| `suppliers` #tabela | fornecedores |
| `accounts_payable` #tabela | contas a pagar (financeiro) |
| `accounts_receivable` #tabela | contas a receber (financeiro) |
| `tickets_suporte` #tabela | chamados de suporte |
| `suporte_mensagens` #tabela | mensagens dos chamados |

## Funções (RPC)
- **`has_role(_user_id, _role)`** — checa papel. Usada no AuthContext.

## Enums
- **`app_role`**: `admin`, `user`
- **`order_status`**: `pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`
- **`payment_status`**: `pending`, `processing`, `paid`, `failed`, `refunded`

## Segurança (RLS)
Migrations `20260621000001_security_enforce_prices` e `20260621000002_security_rls_storage_admin` endureceram RLS de tickets/storage e forçaram preços no servidor. Ver [[Autenticação e Permissões]].
