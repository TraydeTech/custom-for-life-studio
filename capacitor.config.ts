import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.customforlife.app",
  appName: "Custom For Life",
  webDir: "dist",
  backgroundColor: "#0e0e11",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0e0e11",
      showSpinner: false,
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
