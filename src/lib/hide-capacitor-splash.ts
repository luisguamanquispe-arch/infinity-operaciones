/** Oculta el splash nativo de Capacitor (Android/iOS) cuando la UI web ya pintó. */
export async function hideCapacitorSplash(): Promise<void> {
  if (typeof window === "undefined") return;

  const boot = document.getElementById("cap-login-boot");
  if (boot) {
    boot.style.opacity = "0";
    boot.style.transition = "opacity 0.25s ease";
    window.setTimeout(() => boot.remove(), 280);
  }

  try {
    const cap = (
      window as {
        Capacitor?: {
          isNativePlatform?: () => boolean;
          Plugins?: { SplashScreen?: { hide: () => Promise<void> } };
        };
      }
    ).Capacitor;

    if (!cap?.isNativePlatform?.()) return;
    await cap.Plugins?.SplashScreen?.hide();
  } catch {
    /* ignorar */
  }
}
