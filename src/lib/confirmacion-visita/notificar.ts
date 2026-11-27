import { isWhatsAppEnabled } from "@/lib/env";
import { enviarWhatsAppTexto } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { mensajeWhatsappConfirmacion } from "./reglas";

export interface ResultadoEnvioConfirmacion {
  canal: "WHATSAPP" | null;
  enviado: boolean;
  deliveryStatus: "SENT" | "FAILED" | "NOT_CONFIGURED";
  mensajeTexto: string;
  error?: string;
}

/**
 * Envío desacoplado de solicitud de confirmación de visita.
 * Reutiliza la integración Meta WhatsApp Cloud API si está configurada;
 * de lo contrario devuelve NOT_CONFIGURED (sin simular envíos) y entrega el mensaje
 * listo para copiar y compartir manualmente desde el panel Supervisor.
 */
export async function enviarSolicitudConfirmacionCliente(destino: {
  telefono: string | null | undefined;
  url: string;
  programadoTexto?: string | null;
}): Promise<ResultadoEnvioConfirmacion> {
  const mensajeTexto = mensajeWhatsappConfirmacion(destino.url, destino.programadoTexto);

  const telefono = destino.telefono?.trim();
  if (!telefono || !isWhatsAppEnabled()) {
    return {
      canal: "WHATSAPP",
      enviado: false,
      deliveryStatus: "NOT_CONFIGURED",
      mensajeTexto,
    };
  }

  const res = await enviarWhatsAppTexto(telefono, mensajeTexto);
  if (res.simulado) {
    return {
      canal: "WHATSAPP",
      enviado: false,
      deliveryStatus: "NOT_CONFIGURED",
      mensajeTexto,
    };
  }
  if (!res.enviado) {
    return {
      canal: "WHATSAPP",
      enviado: false,
      deliveryStatus: "FAILED",
      mensajeTexto,
      error: res.error || "envio_fallido",
    };
  }
  return {
    canal: "WHATSAPP",
    enviado: true,
    deliveryStatus: "SENT",
    mensajeTexto,
  };
}

/**
 * Notifica de forma idempotente al técnico asignado cuando el cliente cancela o
 * solicita reprogramación (evita notificaciones duplicadas por claveIdem).
 */
export async function notificarTecnicosCambioDisponibilidad(params: {
  ticketId: string;
  codigoTicket: string;
  tecnicoIds: string[];
  motivoEstado: "NO_DISPONIBLE" | "SOLICITA_REPROGRAMACION" | "CANCELADO";
  detalle?: string | null;
  marcaEvento: string;
}): Promise<void> {
  if (!params.tecnicoIds.length) return;
  const titulo =
    params.motivoEstado === "NO_DISPONIBLE"
      ? `Cliente no disponible — ${params.codigoTicket}`
      : params.motivoEstado === "SOLICITA_REPROGRAMACION"
        ? `Reprogramación solicitada — ${params.codigoTicket}`
        : `Confirmación cancelada — ${params.codigoTicket}`;
  const cuerpo =
    params.detalle?.trim() ||
    "No iniciar desplazamiento hasta nueva confirmación del supervisor.";

  for (const tecnicoId of params.tecnicoIds) {
    const claveIdem = `confirmacion:${params.ticketId}:${tecnicoId}:${params.motivoEstado}:${params.marcaEvento}`;
    try {
      await prisma.notificacionTecnico.upsert({
        where: { claveIdem },
        update: {},
        create: {
          tecnicoId,
          ticketId: params.ticketId,
          tipo: "ASIGNACION",
          titulo,
          cuerpo,
          claveIdem,
          codigoTicket: params.codigoTicket,
        },
      });
    } catch (err) {
      console.error("[confirmacion-visita] Error notificando técnico:", err);
    }
  }
}
