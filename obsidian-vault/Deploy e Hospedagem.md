---
tags: [operacao, deploy]
---

# Deploy e Hospedagem

## Onde o site vive
- **Domínio:** `customforlife.com.br` (e `www`)
- **DNS → IP:** `173.255.192.155` (Linode)
- **Servidor:** **nginx** com header `x-cloudez-verify` → servido via **Cloudez**
- **Origem do build:** **Lovable Cloud** (publica a partir do branch `main` do GitHub)

> [!note] Lovable ≠ site no ar
> O **preview do Lovable** tem suas próprias variáveis de ambiente e quase sempre mostra certo. O **site público** é um build separado. Os dois não compartilham env automaticamente.

## Fluxo de publicação
```
push no GitHub (branch main)
  → Lovable sincroniza o código
  → clicar "Publish / Republish" no Lovable   ← passo manual
  → propaga para customforlife.com.br (~1-2 min)
  → hard refresh (Cmd+Shift+R) para furar cache
```

> [!tip] Auto-merge
> O repo tem um workflow **"Auto-merge claude/... into main"** que leva commits de branches `claude/*` direto pro `main`. Por isso um push numa branch de trabalho pode acabar no `main` sozinho — mas **publicar no domínio ainda exige o clique no Lovable**.

## Build
- Comando: `vite build` → saída em `dist/`.
- `vite.config.ts` importa `lovable-tagger` (registry **privado** do Lovable). Build fora do Lovable pode falhar ao baixar essa dep e algumas do registry privado.
- Variáveis `VITE_*` são **inlinadas no momento do build** (ver [[Variáveis de Ambiente]]). Build sem elas já quebrou o site — [[Registro de Incidentes]].

## Checagem rápida de status
```sh
curl -I https://www.customforlife.com.br      # 200 = servidor ok
```
Tela branca/preta com `200` = problema de **frontend**, não de servidor. Ver [[Runbook - Site Fora do Ar]].
