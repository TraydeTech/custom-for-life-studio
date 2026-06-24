---
tags: [frontend, pagina]
---

# Páginas Públicas

Arquivos em `src/pages/`. Roteamento em [[Arquitetura e Rotas]].

## Loja / Compra
- **`Index.tsx`** #pagina — Home. Hero (`ModernHero`), `FeatureStrip`, vitrine de produtos.
- **`Loja.tsx`** #pagina — catálogo / listagem com filtros.
- **`Produto.tsx`** #pagina — detalhe do produto por `:slug`, seleção de variações (`product_variants`), parcelamento (ver [[Pagamentos (PIX e Iugu)]]).
- **`Carrinho.tsx`** #pagina — itens do carrinho. Convidado usa `src/lib/guestCart.ts`; logado usa tabela `cart_items`. Hook [[Hooks#useCart|useCart]].
- **`Checkout.tsx`** #pagina — endereço, pagamento PIX/Iugu, cria `orders` + `order_items`.
- **`PedidoConfirmado.tsx`** #pagina — confirmação pós-pagamento.

## Autenticação
- **`Login.tsx`** / **`Cadastro.tsx`** #pagina — via [[Autenticação e Permissões]].
- **`EsqueciSenha.tsx`** / **`RedefinirSenha.tsx`** #pagina — fluxo de recuperação.

## Área do Cliente (`AccountLayout`)
- **`MinhaConta.tsx`** #pagina — perfil (`profiles`, hook [[Hooks#useProfile|useProfile]]).
- **`MeusPedidos.tsx`** #pagina — histórico de `orders`.
- **`MeusEnderecos.tsx`** #pagina — CRUD de `addresses`.
- **`MeusChamados.tsx`** #pagina — tickets de suporte (`tickets_suporte` / `suporte_mensagens`).

## Especiais
- **`ComingSoon.tsx`** #pagina — "Em Breve" com gradiente animado, logo, CTAs WhatsApp/Instagram. Hoje só em `/em-breve`. Histórico em [[Registro de Incidentes]].
- **`NotFound.tsx`** #pagina — 404.
