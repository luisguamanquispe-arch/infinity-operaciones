import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import {
  asegurarSolicitudConfirmacionVisita,
  cancelarConfirmacionSupervisor,
  confirmarManualSupervisor,
  marcarExentoPresenciaSupervisor,
  marcarSinRespuestaSupervisor,
} from "@/lib/confirmacion-visita/servicio";
import {
  calcularExpiracionConfirmacion,
  derivarVistaConfirmacionVisita,
  MARCA_HISTORICO_EN_CAMINO,
  ticketRequierePresenciaPorDefecto,
  tipoPermiteExencionPresencia,
} from "@/lib/confirmacion-visita/reglas";
import { urlConfirmacionVisitaPublica } from "@/lib/confirmacion-visita/token";
import { limitarTasaConfirmacion } from "@/lib/confirmacion-visita/rate-limit";
import {
  enviarSolicitudConfirmacionCliente,
} from "@/lib/confirmacion-visita/notificar";

const COOLDOWN_REENVIO_MS = 30_000;

/**
 * POST /api/tickets/[id]/confirmacion-visita
 * Gestión exclusiva de Supervisor / Admin:
 * - reenviar: genera/renueva enlace seguro e intenta enviar vía WhatsApp (si configurado)
 * - confirmar_manual: registra confirmación telefónica auditada
 * - marcar_exento: marca que no requiere presencia (solo tipos permitidos, auditado)
 * - marcar_sin_respuesta: marca explícitamente SIN_RESPUESTA sin cerrar ticket
 * - cancelar: revoca/cancela la confirmación y notifica al técnico
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json(
      { error: "Solo Supervisor o Admin puede gestionar confirmaciones de visita." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = typeof body.accion === "string" ? body.accion.trim().toLowerCase() : "";

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true, telefono: true } },
      tecnicos: { select: { tecnicoId: true } },
      confirmacionVisita: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (["CERRADO", "FINALIZADO", "CANCELADO"].includes(ticket.estado)) {
    return NextResponse.json(
      { error: "No se puede gestionar confirmación en un ticket cerrado." },
      { status: 409 }
    );
  }

  if (accion === "reenviar" || accion === "generar") {
    const ahora = new Date();

    // Bloquear tickets exentos por tipo o por exención válida de supervisor (I-2)
    const exentoValido =
      !ticketRequierePresenciaPorDefecto(ticket.tipo) ||
      Boolean(
        ticket.confirmacionVisita &&
          ticket.confirmacionVisita.exentoMotivo !== MARCA_HISTORICO_EN_CAMINO &&
          (ticket.confirmacionVisita.estado === "EXENTO" ||
            ticket.confirmacionVisita.requierePresencia === false) &&
          tipoPermiteExencionPresencia(ticket.tipo)
      );
    if (exentoValido) {
      return NextResponse.json(
        { error: "Este ticket está exento de confirmación de presencia y no requiere enlace." },
        { status: 400 }
      );
    }

    if (!ticket.programadoEn) {
      return NextResponse.json(
        { error: "Programe fecha y hora de visita antes de enviar la solicitud de confirmación." },
        { status: 400 }
      );
    }

    const expCalculada = calcularExpiracionConfirmacion(ticket.programadoEn, ahora);
    if (expCalculada.getTime() <= ahora.getTime()) {
      return NextResponse.json(
        { error: "El horario programado ya venció. Reprograme la visita antes de enviar confirmación." },
        { status: 400 }
      );
    }

    // Protección contra reenvíos repetidos abusivos (I-6): cooldown en BD + rate limit por hora
    const ultimoEnvio = ticket.confirmacionVisita?.ultimoEnvioEn;
    if (
      ultimoEnvio &&
      ticket.confirmacionVisita?.ultimoEnvioEstado === "SENT" &&
      ahora.getTime() - ultimoEnvio.getTime() < COOLDOWN_REENVIO_MS
    ) {
      return NextResponse.json(
        { error: "Espere al menos 30 segundos antes de reenviar la solicitud al cliente." },
        { status: 429 }
      );
    }
    if (!limitarTasaConfirmacion(`confirmacion:reenviar:${ticket.id}`, 6, 60 * 60_000, ahora.getTime())) {
      return NextResponse.json(
        { error: "Se alcanzó el límite temporal de reenvíos para este ticket. Intente más tarde." },
        { status: 429 }
      );
    }

    const forzarNuevoToken = Boolean(body.forzarNuevoToken);
    const row = await asegurarSolicitudConfirmacionVisita({
      ticketId: ticket.id,
      programadoEn: ticket.programadoEn,
      tipo: ticket.tipo,
      usuarioId: session.id,
      forzarNuevoToken,
      ahora,
    });
    if (
      !row ||
      row.estado === "EXENTO" ||
      row.requierePresencia === false ||
      !row.token ||
      row.tokenRevocadoEn
    ) {
      return NextResponse.json(
        { error: "Este ticket no admite envío de enlace de confirmación." },
        { status: 400 }
      );
    }

    const env = getEnv();
    const url = urlConfirmacionVisitaPublica(row.token, env.PUBLIC_APP_URL);
    const envio = await enviarSolicitudConfirmacionCliente({
      telefono: ticket.cliente.telefono,
      url,
      programadoTexto: formatDateTime(ticket.programadoEn),
    });

    // I-2: Solo incrementamos enviosCount cuando el mensaje se envió efectivamente (SENT).
    const updated = await prisma.ticketConfirmacionVisita.update({
      where: { ticketId: ticket.id },
      data: {
        ultimoEnvioEn: ahora,
        ultimoEnvioCanal: envio.canal,
        ultimoEnvioEstado: envio.deliveryStatus,
        ...(envio.enviado ? { enviosCount: { increment: 1 } } : {}),
      },
    });

    await prisma.eventoTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: session.id,
        accion: "CONFIRMACION_VISITA_ENVIADA",
        metadata: JSON.stringify({
          canal: envio.canal,
          deliveryStatus: envio.deliveryStatus,
          enviado: envio.enviado,
          forzarNuevoToken,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      url,
      mensajeTexto: envio.mensajeTexto,
      envio: {
        canal: envio.canal,
        enviado: envio.enviado,
        deliveryStatus: envio.deliveryStatus,
        error: envio.error ?? null,
      },
      confirmacionVisita: derivarVistaConfirmacionVisita(ticket, updated, ahora),
    });
  }

  if (accion === "confirmar_manual") {
    const personaRecibe =
      typeof body.personaRecibe === "string" ? body.personaRecibe : "";
    const nota = typeof body.nota === "string" ? body.nota : undefined;
    const programadoEnEsperado =
      typeof body.programadoEnEsperado === "string" ? body.programadoEnEsperado : undefined;
    const res = await confirmarManualSupervisor({
      ticket,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      rol: session.rol,
      personaRecibe,
      nota,
      programadoEnEsperado,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ ok: true, confirmacionVisita: res.vista });
  }

  if (accion === "marcar_exento") {
    const motivo = typeof body.motivo === "string" ? body.motivo : "";
    const res = await marcarExentoPresenciaSupervisor({
      ticket,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      rol: session.rol,
      motivo,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ ok: true, confirmacionVisita: res.vista });
  }

  if (accion === "marcar_sin_respuesta") {
    const nota = typeof body.nota === "string" ? body.nota : undefined;
    const res = await marcarSinRespuestaSupervisor({
      ticket,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      rol: session.rol,
      nota,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ ok: true, confirmacionVisita: res.vista });
  }

  if (accion === "cancelar") {
    const motivo = typeof body.motivo === "string" ? body.motivo : undefined;
    const res = await cancelarConfirmacionSupervisor({
      ticket,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      rol: session.rol,
      motivo,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ ok: true, confirmacionVisita: res.vista });
  }

  return NextResponse.json(
    {
      error:
        "Acción inválida (use reenviar, confirmar_manual, marcar_exento, marcar_sin_respuesta o cancelar).",
    },
    { status: 400 }
  );
}
