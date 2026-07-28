/**
 * Preload del splash: puente seguro entre el HTML del video y el proceso principal.
 * Solo expone las acciones necesarias para terminar o saltar la intro.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splashApi", {
  /** El video terminó de reproducirse naturalmente. */
  notifyFinished: () => ipcRenderer.send("splash-finished"),
  /** El usuario presionó ESC para saltar la intro. */
  notifySkipped: () => ipcRenderer.send("splash-skipped"),
});
