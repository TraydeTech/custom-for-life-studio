---
tags: [frontend, componente]
---

# Componentes

Em `src/components/`. UI base é **shadcn/ui** (51 componentes em `ui/`).

## Globais (raiz de `components/`)
- **`Header.tsx`** (`layout/`) #componente — cabeçalho/nav da loja.
- **`Footer.tsx`** (`layout/`) #componente — rodapé.
- **`NavLink.tsx`** #componente — link de navegação ativo.
- **`SEOMeta.tsx`** #componente — `<title>`/meta por página (usado p.ex. em `ComingSoon`).
- **`ScrollToTop.tsx`** #componente — reseta scroll ao trocar de rota.
- **`WhatsAppButton.tsx`** #componente — botão flutuante WhatsApp (só fora do admin).
- **`TestModeBanner.tsx`** #componente — faixa de "modo teste" (só fora do admin). Tem lógica de popup/intervalo.

## Home (`components/home/`)
- **`ModernHero.tsx`** — hero da home.
- **`FeatureStrip.tsx`** — faixa de destaques/benefícios.

## Loja (`components/shop/`)
- **`ProductCard.tsx`** — card de produto na vitrine/listagem.

## Conta (`components/account/`)
- **`AccountLayout.tsx`** — casca das páginas "Minha conta".

## Admin (`components/admin/`)
- `AdminLayout`, `AdminSidebar`, `AdminRoute`, `ProtectedAdminRoute`, `AdminRedirect` — navegação + proteção ([[Painel Admin]]).
- `CRUDModule` — CRUD genérico reaproveitável.
- `LowStockAlert`, `OrderReceipt`.

## Outros diretórios
- `components/auth/` — componentes de autenticação.
- `components/support/` — componentes de suporte/chamados.
- `components/ui/` — **shadcn/ui** (button, dialog, select, toast, etc.). Não editar à toa.

## Libs auxiliares (`src/lib/`)
- **`cpf.ts`** — validação/formatação de CPF.
- **`guestCart.ts`** — carrinho de convidado (localStorage).
- **`installments.ts`** — config única de parcelamento (fonte da verdade, sincronizar com Iugu). Ver [[Pagamentos (PIX e Iugu)]].
- **`pix.ts`** — gerador de payload PIX (EMV).
- **`utils.ts`** — helpers (`cn`, etc.).
