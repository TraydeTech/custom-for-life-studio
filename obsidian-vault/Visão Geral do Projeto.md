---
tags: [nucleo, overview]
---

# Visão Geral do Projeto

**Custom For Life** — e-commerce de **brindes personalizados premium** (copos, camisetas, kits corporativos).

- **Domínio:** https://www.customforlife.com.br
- **Origem do código:** projeto [Lovable](https://lovable.dev) (Vite + React + Supabase)
- **Repositório:** `TraydeTech/custom-for-life-studio`
- **Idioma da UI:** Português (BR) — `<html lang="pt-BR">`

## O que o sistema faz

| Área | Resumo |
|------|--------|
| **Loja pública** | Catálogo, página de produto com variações, carrinho, checkout com PIX e parcelamento |
| **Contas de cliente** | Cadastro/login, meus pedidos, endereços, chamados de suporte |
| **Painel admin** | Produtos, categorias, pedidos, clientes, PDV, financeiro, fornecedores, relatórios, chamados |
| **Pagamentos** | PIX (payload EMV próprio) + gateway **Iugu** via Edge Functions |

## Mapa rápido
- Estrutura técnica → [[Stack Técnica]]
- Como roda e publica → [[Deploy e Hospedagem]]
- Telas → [[Páginas Públicas]] e [[Painel Admin]]
- Dados → [[Supabase - Banco de Dados]]

> [!note] Página "Em Breve"
> Existe uma página `ComingSoon` que já foi usada como gate de manutenção em todas as rotas. Hoje fica isolada em `/em-breve`. Histórico em [[Registro de Incidentes]].
