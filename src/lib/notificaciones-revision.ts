import { getEnv } from "@/lib/env";
import { enviarWhatsAppTecnicoTicket } from "@/lib/whatsapp";

type DestinoTecnico = {
  telefono: string | null | undefined;
  nombre: string;
};

function appUrlTecnico(): string {
  const env = getEnv();
  return (
    env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico"
  );
}

async function enviarTextoTecnico(
  destino: DestinoTecnico,
  codigo: string,
  mensajeTexto: string,
  etiqueta: string
) {
  const telefono = destino.telefono?.trim();
  if (!telefono) {
    console.warn(`[WhatsApp ${etiqueta}] Sin teléfono — ${codigo}`);
    return { enviado: false as const, error: "Técnico sin teléfono" };
  }
  const nombre = destino.nombre.split(" ")[0] || "Técnico";
  const result = await enviarWhatsAppTecnicoTicket({
    telefono,
    codigo,
    tecnicoNombre: nombre,
    cliente: "Revisión de reporte",
    sector: "—",
    direccion: "—",
    tipo: "Revisión",
    prioridad: "ALTA",
    programacion: "Inmediato",
    motivo: etiqueta,
    mensajeTexto,
  });
  return result;
}

/** Alerta al técnico responsable: reporte devuelto. */
export async function notificarTecnicoDevolucion(params: {
  codigo: string;
  motivo: string;
  observaciones?: string | null;
  supervisorNombre: string;
  tecnico: DestinoTecnico;
}) {
  const obs = params.observaciones?.trim();
  const mensajeTexto = [
    `⚠️ LGB Operaciones — Reporte por corregir`,
    ``,
    `Hola ${params.tecnico.nombre.split(" ")[0] || "Técnico"},`,
    `El soporte *${params.codigo}* fue *devuelto para corrección* por ${params.supervisorNombre}.`,
    ``,
    `📋 Motivo: ${params.motivo}`,
    obs ? `📝 Observaciones: ${obs}` : null,
    ``,
    `Corrija y envíe desde la app: ${appUrlTecnico()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return enviarTextoTecnico(
    params.tecnico,
    params.codigo,
    mensajeTexto,
    "devolución"
  );
}

/** Aviso genérico (supervisor no tiene WhatsApp dedicado): log + futuro canal. */
export async function notificarSupervisorCorreccion(params: {
  codigo: string;
  tecnicoNombre: string;
}) {
  console.log(
    `[Revisión] ${params.codigo} corregido por ${params.tecnicoNombre} — pendiente de nueva revisión`
  );
  return { ok: true as const };
}
