---
tags: [frontend, hook]
---

# Hooks

Em `src/hooks/`. A maioria usa `@tanstack/react-query` sobre o [[Supabase - Banco de Dados|Supabase]].

| Hook | Função | Tabelas/Origem |
|------|--------|----------------|
| **`useCart`** #hook | estado do carrinho (convidado + logado) | `cart_items` / `guestCart.ts` |
| **`useProfile`** #hook | perfil do usuário logado | `profiles` |
| **`useAdminStats`** #hook | KPIs do dashboard admin | agregações |
| **`useLowStockProducts`** #hook | produtos com estoque baixo | `products` / `product_variants` |
| **`useOpenTicketsCount`** #hook | nº de chamados abertos | `tickets_suporte` |
| **`useOrderNotifications`** #hook | notificações de pedidos | `orders` |
| **`usePendingOrdersCount`** #hook | nº de pedidos pendentes | `orders` |
| **`use-mobile`** #hook | breakpoint mobile | matchMedia |
| **`use-toast`** #hook | API de toasts (shadcn) | — |

> [!tip] Padrão de dados
> Componentes não chamam o Supabase direto: usam hooks → React Query (cache, `staleTime` 5 min, `retry` 1, definidos no `QueryClient` em `App.tsx`).
