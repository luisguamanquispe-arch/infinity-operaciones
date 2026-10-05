/**
 * Programa de escritorio. No abre la URL de Render hasta que /api/health
 * responde con el servicio real. Así no aparece la pantalla negra de cold start.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { APP_URL, APP_TITLE, resolveIntroVideoPath } = require("./config");

const ORIGIN = APP_URL.replace(/\/$/, "");

function servidorListo() {
  return fetch(`${ORIGIN}/api/health`, { cache: "no-store" })
    .then(async (res) => {
      const tipo = res.headers.get("content-type") || "";
      if (!res.ok || !tipo.includes("application/json")) return false;
      const data = await res.json();
      return data && data.ok === true && data.service === "infinity-operaciones";
    })
    .catch(() => false);
}

async function esperarServidor(ventana) {
  const detalle = "El servidor está iniciando. El programa espera en esta pantalla.";
  for (let i = 1; i <= 45; i += 1) {
    if (ventana.isDestroyed()) return false;
    ventana.webContents.executeJavaScript(
      `var n=document.getElementById("msg"); if(n) n.textContent=${JSON.stringify(
        i === 1 ? "Despertando servidor…" : detalle
      )}`
    ).catch(() => {});
    if (await servidorListo()) return true;
    await new Promise((resolve) => setTimeout(resolve, i < 4 ? 1200 : 1800));
  }
  return false;
}

function crearVentanaPrincipal() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#1e40af",
    title: APP_TITLE,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventana.once("ready-to-show", () => ventana.show());
  if (process.env.DESKTOP_DEV_TOOLS === "1") {
    ventana.webContents.openDevTools({ mode: "detach" });
  }
  return ventana;
}

function mostrarSplash() {
  return new Promise((resolve) => {
    const splash = new BrowserWindow({
      width: 960,
      height: 540,
      frame: false,
      backgroundColor: "#1e40af",
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload-splash.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const video = pathToFileURL(resolveIntroVideoPath()).href;
    const archivo = pathToFileURL(path.join(__dirname, "splash.html")).href;
    splash.loadURL(`${archivo}?src=${encodeURIComponent(video)}`);
    const terminar = () => {
      if (!splash.isDestroyed()) splash.close();
      resolve();
    };
    ipcMain.once("splash-finished", terminar);
    ipcMain.once("splash-skipped", terminar);
  });
}

app.whenReady().then(async () => {
  await mostrarSplash();
  const ventana = crearVentanaPrincipal();
  await ventana.loadFile(path.join(__dirname, "boot.html"));
  const listo = await esperarServidor(ventana);
  if (!listo || ventana.isDestroyed()) return;
  await ventana.loadURL(ORIGIN);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
