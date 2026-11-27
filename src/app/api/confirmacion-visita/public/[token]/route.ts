import { NextResponse } from "next/server";
import {
  HEADERS_PUBLICOS_CONFIRMACION,
  ipConfiableDeRequest,
  limitarTasaConfirmacion,
} from "@/lib/confirmacion-visita/rate-limit";
import {
  consultarConfirmacionPorToken,
  responderConfirmacionPorToken,
  type AccionRespuestaCliente,
} from "@/lib/confirmacion-visita/servicio";
import { tokenConfirmacionValido } from "@/lib/confirmacion-visita/reglas";

const ACCIONES_VALIDAS = new Set<AccionRespuestaCliente>([
  "CONFIRMAR",
  "SOLICITA_REPROGRAMACION",
  "NO_DISPONIBLE",
]);

function jsonPublico(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: HEADERS_PUBLICOS_CONFIRMACION,
  });
}

/**
 * GET /api/confirmacion-visita/public/[token]
 * Consulta pública sin login. No expone PII ni identificadores internos ni personaRecibe.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = ipConfiableDeRequest(request);
  if (!limitarTasaConfirmacion(`confirmacion:get:ip:${ip}`, 60, 60_000)) {
    return jsonPublico(
      { error: "Demasiadas solicitudes. Intente nuevamente en un minuto." },
      429
    );
  }

  const { token } = await params;
  if (!tokenConfirmacionValido(token)) {
    return jsonPublico({ error: "Enlace de confirmación no válido." }, 404);
  }

  if (!limitarTasaConfirmacion(`confirmacion:get:tok:${token.slice(0, 16)}`, 30, 60_000)) {
    return jsonPublico(
      { error: "Demasiadas consultas para este enlace. Intente nuevamente en un minuto." },
      429
    );
  }

  const res = await consultarConfirmacionPorToken(token);
  if (!res.ok) {
    return jsonPublico({ error: res.error }, res.status);
  }

  return jsonPublico(res, 200);
}

/**
 * POST /api/confirmacion-visita/public/[token]
 * Registra la respuesta del cliente: CONFIRMAR, SOLICITA_REPROGRAMACION o NO_DISPONIBLE.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = ipConfiableDeRequest(request);
  if (!limitarTasaConfirmacion(`confirmacion:post:ip:${ip}`, 20, 60_000)) {
    return jsonPublico(
      { error: "Demasiadas solicitudes. Espere un momento e intente nuevamente." },
      429
    );
  }

  const { token } = await params;
  if (!tokenConfirmacionValido(token)) {
    return jsonPublico({ error: "Enlace de confirmación no válido." }, 404);
  }

  if (!limitarTasaConfirmacion(`confirmacion:post:tok:${token.slice(0, 16)}`, 10, 60_000)) {
    return jsonPublico(
      { error: "Demasiados intentos sobre este enlace. Espere un minuto e intente nuevamente." },
      429
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accionRaw = typeof body.accion === "string" ? body.accion.trim().toUpperCase() : "";
  if (!ACCIONES_VALIDAS.has(accionRaw as AccionRespuestaCliente)) {
    return jsonPublico(
      { error: "Acción inválida. Use CONFIRMAR, SOLICITA_REPROGRAMACION o NO_DISPONIBLE." },
      400
    );
  }

  const personaRecibe =
    typeof body.personaRecibe === "string" ? body.personaRecibe : undefined;
  const horarioSolicitado =
    typeof body.horarioSolicitado === "string" ? body.horarioSolicitado : undefined;
  const observacionCliente =
    typeof body.observacionCliente === "string" ? body.observacionCliente : undefined;

  const res = await responderConfirmacionPorToken({
    token,
    accion: accionRaw as AccionRespuestaCliente,
    personaRecibe,
    horarioSolicitado,
    observacionCliente,
  });

  if (!res.ok) {
    return jsonPublico({ error: res.error }, res.status);
  }

  // Respuesta pública acotada sin PII ni metadatos internos de gestión manual
  return jsonPublico(
    {
      ok: true,
      duplicada: res.duplicada,
      confirmacionVisita: {
        estado: res.vista.estado,
        estadoLabel: res.vista.estadoLabel,
        confirmadoEn: res.vista.confirmadoEn,
      },
    },
    200
  );
}
