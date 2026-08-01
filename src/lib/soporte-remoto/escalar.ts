import { prisma } from "@/lib/prisma";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import {
  SR_TIPO_SOPORTE_LABELS,
  type SrResultado,
} from "./labels";

export async function escalarSrTicketAPresencial(opts: {
  ticketId: string;
  usuarioId: string;
  usuarioNombre: string;
  resultado?: SrResultado;
  nota?: string;
}) {
  const sr = await prisma.srTicket.findUnique({ where: { id: opts.ticketId } });

  if (!sr) throw new Error("Ticket de soporte remoto no encontrado");
  if (sr.ticketPresencialId) {
    throw new Error("Este soporte ya tiene una orden presencial vinculada");
  }
  if (!sr.clienteId) {
    throw new Error(
      "Debe vincular un cliente del CRM antes de escalar a visita técnica"
    );
  }

  const resultado: SrResultado =
    opts.resultado === "ESCALADO_SOPORTE_TECNICO"
      ? "ESCALADO_SOPORTE_TECNICO"
      : "REQUIERE_VISITA";

  const tipoLabel =
    sr.tipoSoporte === "OTRO" && sr.tipoSoporteOtro
      ? `Otro: ${sr.tipoSoporteOtro}`
      : SR_TIPO_SOPORTE_LABELS[sr.tipoSoporte];

  const descripcion = [
    `Escalado desde Soporte Remoto ${sr.codigo}`,
    `Motivo: ${tipoLabel}`,
    "",
    "Problema reportado:",
    sr.descripcionProblema,
    "",
    "Acciones realizadas:",
    sr.accionesRealizadas || "—",
    sr.observaciones ? `\nObservaciones:\n${sr.observaciones}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const slaHoras = slaHorasPorPrioridad(sr.prioridad);
  const codigo = await generarCodigoTicket("SOPORTE");

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: sr.clienteId,
      tipo: "SOPORTE",
      prioridad: sr.prioridad,
      estado: "PENDIENTE",
      motivo: `Soporte Remoto ${sr.codigo}: ${tipoLabel}`,
      descripcion,
      slaHoras,
      slaVenceEn: new Date(Date.now() + slaHoras * 60 * 60 * 1000),
    },
  });

  const horaFin = sr.horaFin || new Date();
  const tiempoMinutos =
    sr.tiempoMinutos ??
    (sr.horaInicio
      ? Math.max(0, Math.round((horaFin.getTime() - sr.horaInicio.getTime()) / 60000))
      : null);

  await prisma.$transaction([
    prisma.srTicket.update({
      where: { id: sr.id },
      data: {
        estado: "ESCALADO",
        resultado,
        ticketPresencialId: ticket.id,
        horaFin,
        tiempoMinutos,
        historial: {
          create: {
            usuarioId: opts.usuarioId,
            usuarioNombre: opts.usuarioNombre,
            tiempoMinutos,
            estado: "ESCALADO",
            nota:
              opts.nota ||
              `Escalado a orden presencial ${codigo} (pendiente de asignación)`,
          },
        },
      },
    }),
    prisma.eventoTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: opts.usuarioId,
        accion: "ESCALADO_DESDE_SOPORTE_REMOTO",
        metadata: JSON.stringify({
          srTicketId: sr.id,
          srCodigo: sr.codigo,
          resultado,
        }),
      },
    }),
  ]);

  return { ticket, codigo, srTicketId: sr.id };
}
