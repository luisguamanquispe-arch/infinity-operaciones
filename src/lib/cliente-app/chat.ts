/**
 * Chat Connect desactivado (reemplazo Help Desk → Soporte Remoto).
 * Las rutas API responden 503; este módulo se conserva vacío para no romper imports residuales.
 */

export async function obtenerOCrearSesionChat(): Promise<never> {
  throw new Error("CHAT_DISABLED");
}

export async function listarMensajesChat(): Promise<null> {
  return null;
}

export async function enviarMensajeCliente(): Promise<never> {
  throw new Error("CHAT_DISABLED");
}

export function serializeConversacion() {
  return null;
}

export function serializeMensaje() {
  return null;
}
