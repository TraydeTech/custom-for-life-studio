---
tags: [nucleo, arquitetura, rotas]
---

# Arquitetura e Rotas

## Boot da aplicação
```
index.html → src/main.tsx → <App/> (src/App.tsx)
```
`App.tsx` monta os providers nesta ordem:
`QueryClientProvider` → `AuthProvider` ([[Autenticação e Permissões]]) → `TooltipProvider` → `Toaster`/`Sonner` → `BrowserRouter` → `AppContent`.

> [!warning] Ponto crítico de boot
> `AuthProvider` importa o cliente Supabase (`src/integrations/supabase/client.ts`). Se esse cliente falhar ao inicializar, **o app inteiro quebra em tela preta**. Foi a causa do incidente — ver [[Registro de Incidentes]].

## Lazy loading
Todas as páginas usam `React.lazy()` + `<Suspense>` com spinner de fallback. Cada rota vira um chunk JS separado.

## Rotas públicas (`src/pages/`)
| Path | Página | Nota |
|------|--------|------|
| `/` | `Index` (Home) | [[Páginas Públicas]] |
| `/loja` | `Loja` | catálogo |
| `/produto/:slug` | `Produto` | variações |
| `/carrinho` | `Carrinho` | |
| `/checkout` | `Checkout` | PIX/Iugu |
| `/pedido-confirmado` | `PedidoConfirmado` | |
| `/login` | `Login` | |
| `/cadastro` | `Cadastro` | |
| `/esqueci-senha` | `EsqueciSenha` | |
| `/redefinir-senha` | `RedefinirSenha` | |
| `/minha-conta` | `MinhaConta` | |
| `/meus-pedidos` | `MeusPedidos` | |
| `/meus-enderecos` | `MeusEnderecos` | |
| `/meus-chamados` | `MeusChamados` | suporte |
| `/em-breve` | `ComingSoon` | gate de manutenção (isolado) |
| `*` | `NotFound` | 404 |

## Rotas admin (`/admin/*`)
Sempre acessíveis no router, protegidas dentro das páginas — ver [[Painel Admin]].
`/admin/login`, `/admin`, `/admin/pdv`, `/admin/produtos`, `/admin/categorias`, `/admin/pedidos`, `/admin/financeiro`, `/admin/clientes`, `/admin/fornecedores`, `/admin/relatorios`, `/admin/chamados`, `/admin/gestao-pedidos`.

## Globais (fora do admin)
- `[[Componentes#TestModeBanner|TestModeBanner]]` e `[[Componentes#WhatsAppButton|WhatsAppButton]]` aparecem só em rotas **não-admin**.
- `ScrollToTop` reseta o scroll a cada navegação.
