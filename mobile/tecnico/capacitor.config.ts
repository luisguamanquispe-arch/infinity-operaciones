import type { CapacitorConfig } from "@capacitor/cli";

/** URL del backend (Render / dominio propio). Sobrescribir con CAPACITOR_SERVER_URL en .env */
const serverUrl = (
  process.env.CAPACITOR_SERVER_URL || "https://infinity-operaciones-b3ij.onrender.com"
).replace(/\/$/, "");

/** true = WebView carga el servidor directo (solo desarrollo en vivo). false = splash local en www/ */
const useRemoteServer = process.env.CAPACITOR_DIRECT_SERVER === "true";

const config: CapacitorConfig = {
  appId: "ec.lgbsistemas.tecnico",
  appName: "Infinity Técnicos",
  webDir: "www",
  ...(useRemoteServer
    ? {
        server: {
          url: `${serverUrl}/login?app=tecnico`,
          androidScheme: "https",
          iosScheme: "https",
          allowNavigation: [
            serverUrl,
            "infinity-operaciones-b3ij.onrender.com",
            "infinity-operaciones.onrender.com",
            "ops.lgbsistemas.ec",
            "lgbsistemas.ec",
            "localhost",
            "10.0.2.2",
          ],
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#1e40af",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1e40af",
    },
  },
};

export default config;
