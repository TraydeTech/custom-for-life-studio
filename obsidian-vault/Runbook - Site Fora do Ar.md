---
tags: [operacao, runbook]
---

# Runbook — Site Fora do Ar

Passo a passo para diagnosticar `customforlife.com.br` "fora do ar". Baseado no [[Registro de Incidentes]].

## 1. Servidor está respondendo?
```sh
curl -I https://www.customforlife.com.br
```
- **Sem resposta / timeout / 5xx** → problema de servidor/hospedagem (Cloudez/Lovable). Pular pro passo 4.
- **`HTTP/2 200`** → servidor ok. O problema é **frontend**. Siga.

## 2. Olhar o navegador
Abrir o site → **F12 → Console**. Procurar erro vermelho.
- `supabaseUrl is required` → **env faltando no build**. Ver passo 3.
- Outro erro JS → investigar o stack.
- Sem erro, mas só "Em Breve" → checar rotas em `src/App.tsx` (gate `ComingSoon`).

## 3. Tela preta/branca + `supabaseUrl is required`
- Confirmar que `src/integrations/supabase/client.ts` tem os **fallbacks** (`?? "https://ihkbxdayhdewqzezdrfl.supabase.co"` etc.).
- Configurar as 4 vars `VITE_*` no Lovable Cloud → [[Variáveis de Ambiente]].
- **Rebuild + Publish** no Lovable.

## 4. Verificações de infra
```sh
curl -sv https://www.customforlife.com.br 2>&1 | grep -i expire   # cert
```
- DNS deve resolver p/ `173.255.192.155`.
- Cert SSL válido?
- Se o servidor não responde → painel **Cloudez** / **Lovable Cloud**.

## 5. Publicar a correção
```
push → main  →  Lovable: Publish/Republish  →  hard refresh (Cmd+Shift+R)
```
Detalhes em [[Deploy e Hospedagem]].
