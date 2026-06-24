---
tags: [frontend, pagina, admin]
---

# Painel Admin

Arquivos em `src/pages/admin/`. Layout e proteção em `src/components/admin/`.

## Proteção de acesso
- **`ProtectedAdminRoute` / `AdminRoute`** — bloqueiam acesso de quem não é admin.
- Admin é verificado por `isAdmin` do [[Autenticação e Permissões|AuthContext]] (RPC `has_role` + fallback `user_roles`).
- **`AdminLayout`** + **`AdminSidebar`** — casca visual. **`AdminRedirect`** redireciona conforme estado.

## Páginas
| Página | Path | Função | Dados |
|--------|------|--------|-------|
| `AdminLogin` | `/admin/login` | login do painel | auth |
| `Dashboard` | `/admin` | visão geral / KPIs | [[Hooks#useAdminStats]] |
| `Produtos` | `/admin/produtos` | CRUD produtos + variações | `products`, `product_variants` |
| `Categorias` | `/admin/categorias` | CRUD categorias | `categories` |
| `Pedidos` | `/admin/pedidos` | lista de pedidos | `orders` |
| `GestaoPedidos` | `/admin/gestao-pedidos` | gestão/status de pedidos | `orders` |
| `Clientes` | `/admin/clientes` | base de clientes | `profiles` |
| `PDV` | `/admin/pdv` | ponto de venda | `orders` |
| `Financeiro` | `/admin/financeiro` | contas a pagar/receber | `accounts_payable`, `accounts_receivable` |
| `Fornecedores` | `/admin/fornecedores` | CRUD fornecedores | `suppliers` |
| `Relatorios` | `/admin/relatorios` | relatórios + export `xlsx` | vários |
| `Chamados` | `/admin/chamados` | suporte | `tickets_suporte`, `suporte_mensagens` |

## Componentes admin reaproveitáveis
- **`CRUDModule`** — base genérica de CRUD usada por várias telas.
- **`LowStockAlert`** — alerta de estoque baixo ([[Hooks#useLowStockProducts]]).
- **`OrderReceipt`** — recibo/comprovante de pedido.

Ver também [[Componentes]].
