# Custom For Life — App iOS & Android

O mesmo site (React + Vite + Supabase) roda também como app nativo iOS e
Android, empacotado com [Capacitor](https://capacitorjs.com). Não há código
duplicado: o app carrega exatamente as mesmas telas, cores, produtos, login e
backend (Supabase) do site.

## O que muda no app

- **Painel admin fica de fora.** É ferramenta interna, só acessível pelo site.
  No app, qualquer rota `/admin/*` redireciona para a home
  (`src/App.tsx` + `src/lib/native.ts`, via `Capacitor.isNativePlatform()`).
- **Login e dados** usam o mesmo Supabase do site. A sessão do cliente é
  persistida no dispositivo e os dados continuam salvos no servidor.
- **Extras nativos:** status bar clara, splash screen e botão "voltar" do
  Android ligado à navegação (`src/lib/native.ts`).

## Estrutura

- `capacitor.config.ts` — id (`br.com.customforlife.app`), nome e `webDir: dist`.
- `ios/` — projeto Xcode (abre no Mac).
- `android/` — projeto Android Studio / Gradle.
- Pastas nativas versionadas; os assets web copiados e builds ficam no
  `.gitignore` de cada plataforma (gerados por `cap sync`).

## Rodar / atualizar o app

Sempre que mudar o site, rode um sync (faz `vite build` + copia para os
projetos nativos):

```bash
npm run app:sync
```

Abrir no Xcode (precisa de macOS):

```bash
npm run app:ios
# instala os Pods na 1ª vez: cd ios/App && pod install
```

Abrir no Android Studio:

```bash
npm run app:android
```

Depois, dentro do Xcode / Android Studio, é só rodar no simulador/dispositivo
ou gerar o build para publicar na App Store / Play Store.

## Publicar

1. `npm run app:sync`
2. **iOS:** Xcode → escolher time de assinatura → Product → Archive → subir
   pelo App Store Connect.
3. **Android:** Android Studio → Build → Generate Signed Bundle (`.aab`) →
   subir no Play Console.

Ícone e splash: substituir os assets em `ios/App/App/Assets.xcassets` e
`android/app/src/main/res/`. Para gerar todos os tamanhos de uma vez, dá pra
usar `@capacitor/assets` a partir de um ícone 1024×1024.
