---
tags: [nucleo, stack]
---

# Stack Técnica

## Frontend
- **Build:** [Vite](https://vitejs.dev) 5 + `@vitejs/plugin-react-swc`
- **Framework:** React 18 + TypeScript 5
- **Roteamento:** `react-router-dom` 6 (lazy loading por rota — ver [[Arquitetura e Rotas]])
- **Estado servidor:** `@tanstack/react-query` 5
- **Estilo:** Tailwind CSS 3 + `tailwindcss-animate` + `@tailwindcss/typography`
- **UI kit:** **shadcn/ui** (Radix UI) — **51 componentes** em `src/components/ui/`
- **Formulários:** `react-hook-form` + `zod` (`@hookform/resolvers`)
- **Ícones:** `lucide-react`
- **Toasts:** `sonner` + toaster shadcn
- **Gráficos:** `recharts` (dashboards admin)
- **Carrossel:** `embla-carousel-react`
- **Planilhas:** `xlsx` (exportação de relatórios)
- **QR Code:** `qrcode.react` (PIX)

## Backend
- **Supabase** (`@supabase/supabase-js` 2) — Postgres + Auth + Storage + Edge Functions
- Detalhes → [[Supabase - Banco de Dados]] · [[Supabase - Edge Functions]]

## Ferramentas Lovable
- `lovable-tagger` (devDependency) — usado no `vite.config.ts`. **Vem do registry privado do Lovable**; builds fora do Lovable podem falhar ao baixá-lo (ver [[Deploy e Hospedagem]]).

## Scripts (`package.json`)
| Script | Comando | Uso |
|--------|---------|-----|
| `dev` | `vite` | Dev server |
| `build` | `vite build` | Build de produção (o que o Lovable roda) |
| `build:dev` | `vite build --mode development` | Build modo dev |
| `lint` | `eslint .` | Lint |
| `test` | `vitest run` | Testes |
| `preview` | `vite preview` | Servir build local |

## Qualidade
- **ESLint** 9 + `typescript-eslint` + plugins react-hooks / react-refresh
- **Vitest** + Testing Library + jsdom (`src/test/`)
