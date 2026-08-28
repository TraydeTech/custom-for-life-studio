/**
 * Integração nativa (Capacitor).
 *
 * O mesmo código React roda no site (navegador) e dentro do app iOS/Android
 * empacotado com Capacitor. Este módulo concentra os ajustes que só fazem
 * sentido quando estamos rodando dentro do app nativo:
 *
 *  - `isNativeApp()` — detecta se estamos no app (vs. navegador). Usado para
 *    esconder o painel admin do app publicado nas lojas.
 *  - `initNative()` — configura status bar, esconde a splash screen e liga o
 *    botão "voltar" do Android à navegação do React Router.
 *
 * No navegador tudo isso vira no-op, então importar/chamar é seguro no site.
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Inicializa os plugins nativos. Idempotente e tolerante a falhas: qualquer
 * plugin ausente apenas é ignorado, sem quebrar o app.
 *
 * @param onBack Callback do botão voltar do Android. Deve devolver `true` se
 *   a navegação foi tratada (ainda há histórico) ou `false` para deixar o
 *   sistema fechar/minimizar o app.
 */
export async function initNative(onBack: () => boolean): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#ffffff" });
    }
  } catch {
    /* plugin ausente — segue sem status bar customizada */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* sem splash screen */
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      const handled = onBack();
      if (!handled && !canGoBack) {
        App.exitApp();
      }
    });
  } catch {
    /* sem botão voltar (iOS não tem) */
  }
}
