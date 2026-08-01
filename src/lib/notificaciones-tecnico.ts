import { formatDateTime, PRIORIDAD_LABELS, TIPO_LABELS } from "@/lib/utils";
import { getEnv } from "@/lib/env";
import { enviarWhatsAppTecnicoTicket } from "@/lib/whatsapp";

type TicketAsignado = {
  codigo: string;
  tipo: string;
  prioridad: string;
  motivo: string | null;
  descripcion?: string | null;
  nodoAfectado?: string | null;
  zonaInfra?: string | null;
  programadoEn: Date | null;
  tecnico: { telefono: string | null; usuario: { nombre: string } } | null;
  cliente: { nombre: string; direccion: string; sector: string };
};

function appUrlTecnico(): string {
  const env = getEnv();
  return (
    env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://infinity-operaciones-b3ij.onrender.com/login?app=tecnico"
  );
}

function construirMensaje(ticket: TicketAsignado, nombreTecnico: string): string {
  const programacion = ticket.programadoEn
    ? formatDateTime(ticket.programadoEn)
    : "Por confirmar (revise la app)";

  const esInfra = ticket.tipo === "INFRAESTRUCTURA";

  const lineas = [
    `🔔 LGB Operaciones — Nueva orden`,
    ``,
    `Hola ${nombreTecnico},`,
    esInfra
      ? `Se le asignó la orden de *Soporte de Infraestructura* *${ticket.codigo}*.`
      : `Se le asignó el ticket *${ticket.codigo}* para atender.`,
    ``,
    `📋 Tipo: ${TIPO_LABELS[ticket.tipo] || ticket.tipo}`,
    `⚡ Prioridad: ${PRIORIDAD_LABELS[ticket.prioridad] || ticket.prioridad}`,
    `📅 Programado: ${programacion}`,
    ``,
  ];

  if (esInfra) {
    lineas.push(`🏗️ Nodo: ${ticket.nodoAfectado || "—"}`);
    if (ticket.zonaInfra) lineas.push(`📍 Zona: ${ticket.zonaInfra}`);
  } else {
    lineas.push(
      `👤 Cliente: ${ticket.cliente.nombre}`,
      `📍 Sector: ${ticket.cliente.sector}`,
      `🏠 Dirección: ${ticket.cliente.direccion}`
    );
  }

  if (ticket.motivo) lineas.push(`🔧 Motivo: ${ticket.motivo}`);
  if (ticket.descripcion) lineas.push(`📝 Detalle: ${ticket.descripcion}`);

  lineas.push("", `Ingrese a la app: ${appUrlTecnico()}`);

  return lineas.join("\n");
}

export async function notificarTecnicoAsignacion(ticket: TicketAsignado) {
  const telefono = ticket.tecnico?.telefono?.trim();
  if (!telefono) {
    console.warn(`[WhatsApp técnico] Sin teléfono — ticket ${ticket.codigo}`);
    return { enviado: false, error: "Técnico sin teléfono registrado" };
  }

  const nombreTecnico = ticket.tecnico!.usuario.nombre.split(" ")[0] || "Técnico";
  const programacion = ticket.programadoEn
    ? formatDateTime(ticket.programadoEn)
    : "Por confirmar";

  const mensajeTexto = construirMensaje(ticket, nombreTecnico);

  const esInfra = ticket.tipo === "INFRAESTRUCTURA";

  const result = await enviarWhatsAppTecnicoTicket({
    telefono,
    codigo: ticket.codigo,
    tecnicoNombre: nombreTecnico,
    cliente: esInfra ? `NODO ${ticket.nodoAfectado || "INFRA"}` : ticket.cliente.nombre,
    sector: esInfra ? ticket.zonaInfra || "INFRAESTRUCTURA" : ticket.cliente.sector,
    direccion: esInfra ? ticket.nodoAfectado || "Varios nodos" : ticket.cliente.direccion,
    tipo: TIPO_LABELS[ticket.tipo] || ticket.tipo,
    prioridad: PRIORIDAD_LABELS[ticket.prioridad] || ticket.prioridad,
    programacion,
    motivo: ticket.motivo || "Soporte técnico",
    mensajeTexto,
  });

  if (result.enviado) {
    console.log(`[WhatsApp técnico] Alerta enviada — ${ticket.codigo} → ${telefono}`);
  } else {
    console.error(`[WhatsApp técnico] Falló — ${ticket.codigo}:`, result.error);
  }

  return result;
}
