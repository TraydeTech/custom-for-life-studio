---
tags: [operacao, deploy, env]
---

# Variáveis de Ambiente

Template em `.env.example`. **Prefixo `VITE_`** → expostas no bundle do navegador (não guardar segredo de servidor aqui).

| Variável | Uso | Onde configurar |
|----------|-----|-----------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Lovable + build de produção |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key (pública, RLS protege) | idem |
| `VITE_SUPABASE_PROJECT_ID` | id do projeto (`ihkbxdayhdewqzezdrfl`) | idem |
| `VITE_PIX_KEY` | chave PIX p/ [[Pagamentos (PIX e Iugu)]] | idem |

> [!danger] Armadilha do build-time (causa raiz do incidente)
> Vite **chumba** `import.meta.env.VITE_*` no build. Se um build roda **sem** essas vars, o valor fica `undefined`. O cliente Supabase fazia `createClient(undefined, ...)` → lança `supabaseUrl is required` no carregamento → **app inteiro em tela preta**.
>
> **Mitigação aplicada:** `client.ts` agora tem **fallback** com URL + anon key públicas (`?? "..."`). Env ainda vence se existir; sem env, usa o fallback e o app sobe. Detalhe em [[Registro de Incidentes]].

> [!tip] Recomendação
> Mesmo com fallback, **configurar as 4 vars de verdade** no Lovable Cloud / build de produção. Fallback é rede de segurança, não substituto.
