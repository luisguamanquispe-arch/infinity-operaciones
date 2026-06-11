import type { CapacitorConfig } from "@capacitor/cli";

/** URL del backend desplegado (Render / ops.lgbsistemas.ec). Sobrescribir con CAPACITOR_SERVER_URL */
const serverUrl = (
  process.env.CAPACITOR_SERVER_URL || "https://infinity-operaciones.onrender.com"
).replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "ec.lgbsistemas.tecnico",
  appName: "LGB Técnicos",
  webDir: "www",
  server: {
    url: `${serverUrl}/login?app=tecnico`,
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      serverUrl,
      "infinity-operaciones.onrender.com",
      "ops.lgbsistemas.ec",
      "lgbsistemas.ec",
      "localhost",
      "10.0.2.2",
    ],
    cleartext: serverUrl.startsWith("http://"),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#1e40af",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1e40af",
    },
  },
};

export default config;
