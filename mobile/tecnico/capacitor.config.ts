import type { CapacitorConfig } from "@capacitor/cli";

/** Única producción: b3ij. No usar …-b3ij-3z9n… (decomisado). */
const PRODUCTION_SERVER = "https://infinity-operaciones-b3ij.onrender.com";

/** URL del backend. Sobrescribir con CAPACITOR_SERVER_URL solo en dev. */
const serverUrl = (process.env.CAPACITOR_SERVER_URL || PRODUCTION_SERVER).replace(/\/$/, "");

if (/b3ij-3z9n/i.test(serverUrl)) {
  throw new Error(
    "CAPACITOR_SERVER_URL apunta a 3z9n (decomisado). Use https://infinity-operaciones-b3ij.onrender.com"
  );
}

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
            "ops.lgbsistemas.ec",
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
