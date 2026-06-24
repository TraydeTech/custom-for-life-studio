---
tags: [operacao, incidente]
---

# Registro de Incidentes

## 2026-06-24 — Site "fora do ar" (tela preta + "Em Breve") #incidente

### Sintoma
`customforlife.com.br` abria **tela preta/escura**, sem conteúdo. Aparência de "site fora do ar".

### Investigação
| Camada | Estado | Como verificado |
|--------|--------|-----------------|
| DNS | ✅ ok | resolve p/ `173.255.192.155` (Linode) |
| Servidor | ✅ ok | `curl -I` → `HTTP/2 200`, nginx |
| SSL | ✅ ok | cert válido até Ago/2026 |
| Frontend | ❌ quebrado | Console: `Error: supabaseUrl is required.` |

→ Servidor nunca caiu. O **app React crashava no boot**.

### Causa raiz #1 — tela preta
`src/integrations/supabase/client.ts` lia `VITE_SUPABASE_URL` só do **env de build**. Um build rodou **sem** essa variável → `createClient(undefined, ...)` lança `supabaseUrl is required` no carregamento do módulo → `AuthProvider` importa esse cliente → **app inteiro morre antes de renderizar**.
Contexto da armadilha em [[Variáveis de Ambiente]].

### Causa raiz #2 — página "Em Breve"
`src/App.tsx` estava com **todas as rotas públicas** apontando para `<ComingSoon />` (commit `chore: reativar coming soon`). Mesmo com o app funcionando, só aparecia o "Em Breve".

### Correções aplicadas
1. **`client.ts`** — fallback com URL + anon key públicas (`?? "..."`). App sobe mesmo sem env no build.
   - commit `e0305fa` — *fix: prevent blank screen when Supabase env vars are missing at build time*
2. **`App.tsx`** — rotas restauradas para as páginas reais (`Home`, `Loja`, ...). `ComingSoon` isolado em `/em-breve`.
   - commit `13ba4a7` — *fix: restore real public routes, remove coming-soon gate*

Validação: `vite build` **sem nenhum env** → compilou e a URL ficou chumbada no bundle. Merge no `main` (via auto-merge) + **Publish no Lovable** → site voltou ao normal. ✅

### Lições
- Lovable preview ≠ site no ar ([[Deploy e Hospedagem]]).
- Build sem `VITE_*` = tela branca/preta. Sempre configurar env no build de produção.
- `200 OK` + tela vazia = problema de frontend, não de servidor.

Procedimento reutilizável → [[Runbook - Site Fora do Ar]].
