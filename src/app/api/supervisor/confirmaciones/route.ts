import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnv, isWhatsAppEnabled } from "@/lib/env";
import { whereTicketActivoEnLista } from "@/lib/ticket-antiguedad";
import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";
import { rangoDiaActualEcuador } from "@/lib/tecnico-fecha-hoy";
import { formatDateTime } from "@/lib/utils";
import {
  derivarVistaConfirmacionVisita,
  esTokenConfirmacionActivo,
  mensajeWhatsappConfirmacion,
  tipoPermiteExencionPresencia,
} from "@/lib/confirmacion-visita/reglas";
import { urlConfirmacionVisitaPublica } from "@/lib/confirmacion-visita/token";

export const runtime = "nodejs";

/**
 * GET /api/supervisor/confirmaciones?filtro=...
 * Lista de gestión de confirmaciones de disponibilidad de visita para Supervisor / Admin.
 */
export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filtro = (searchParams.get("filtro") || "TODOS").toUpperCase();

  const ahora = new Date();
  const rangoHoy = rangoDiaActualEcuador(ahora);
  const env = getEnv();

  const tickets = await prisma.ticket.findMany({
    where: whereTicketActivoEnLista({ tipo: { not: "INFRAESTRUCTURA" } }, ahora),
    include: {
      ...ticketIncludeTecnicos,
      confirmacionVisita: true,
    },
    orderBy: [{ programadoEn: "asc" }, { prioridad: "asc" }, { createdAt: "desc" }],
    take: 150,
  });

  const items = tickets.map((t) => {
    const vista = derivarVistaConfirmacionVisita(t, t.confirmacionVisita, ahora);
    const esHoy =
      t.programadoEn != null &&
      t.programadoEn.getTime() >= rangoHoy.inicio.getTime() &&
      t.programadoEn.getTime() < rangoHoy.finExclusivo.getTime();
    const tokenActivo = esTokenConfirmacionActivo(t, t.confirmacionVisita, ahora)
      ? t.confirmacionVisita!.token!
      : null;
    const urlConfirmacion = tokenActivo
      ? urlConfirmacionVisitaPublica(tokenActivo, env.PUBLIC_APP_URL)
      : null;
    const mensajeSugerido = urlConfirmacion
      ? mensajeWhatsappConfirmacion(
          urlConfirmacion,
          t.programadoEn ? formatDateTime(t.programadoEn) : null
        )
      : null;

    return {
      id: t.id,
      codigo: t.codigo,
      tipo: t.tipo,
      prioridad: t.prioridad,
      estadoTicket: t.estado,
      programadoEn: t.programadoEn?.toISOString() ?? null,
      esHoy,
      permiteExencion: tipoPermiteExencionPresencia(t.tipo),
      cliente: {
        nombre: t.cliente.nombre,
        sector: t.cliente.sector,
        telefono: t.cliente.telefono,
      },
      tecnicosLabel: nombresTecnicosTicket(t),
      confirmacionVisita: vista,
      urlConfirmacion,
      mensajeSugerido,
    };
  });

  const kpis = {
    pendientes: items.filter((i) => i.confirmacionVisita.estado === "PENDIENTE_CONFIRMACION").length,
    confirmadosHoy: items.filter(
      (i) => i.confirmacionVisita.estado === "CONFIRMADO" && i.esHoy
    ).length,
    reprogramacion: items.filter(
      (i) => i.confirmacionVisita.estado === "SOLICITA_REPROGRAMACION"
    ).length,
    noDisponibles: items.filter((i) => i.confirmacionVisita.estado === "NO_DISPONIBLE").length,
    sinRespuesta: items.filter((i) => i.confirmacionVisita.estado === "SIN_RESPUESTA").length,
    canceladasInvalidadas: items.filter((i) =>
      ["CANCELADO", "EXPIRADO", "INVALIDADO_CAMBIO_HORARIO"].includes(
        i.confirmacionVisita.estado
      )
    ).length,
    exentos: items.filter((i) => i.confirmacionVisita.estado === "EXENTO").length,
  };

  const filtrados = items.filter((i) => {
    const e = i.confirmacionVisita.estado;
    switch (filtro) {
      case "PENDIENTE_CONFIRMACION":
        return e === "PENDIENTE_CONFIRMACION";
      case "CONFIRMADO_HOY":
        return e === "CONFIRMADO" && i.esHoy;
      case "SOLICITA_REPROGRAMACION":
        return e === "SOLICITA_REPROGRAMACION";
      case "NO_DISPONIBLE":
        return e === "NO_DISPONIBLE";
      case "SIN_RESPUESTA":
        return e === "SIN_RESPUESTA";
      case "CANCELADO":
        return ["CANCELADO", "EXPIRADO", "INVALIDADO_CAMBIO_HORARIO"].includes(e);
      case "EXENTO":
        return e === "EXENTO";
      default:
        return true;
    }
  });

  return NextResponse.json({
    whatsappConfigurado: isWhatsAppEnabled(),
    fechaLocalEcuador: rangoHoy.fechaLocal,
    kpis,
    items: filtrados,
  });
}
