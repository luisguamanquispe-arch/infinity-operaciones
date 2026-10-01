import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import {
  puedeAdministrarSatisfaccion,
  puedeConsultarSatisfaccion,
  puedeRegistrarSeguimiento,
  ESTADOS_ENCUESTA,
  SOLUCIONES,
  TIPOS_SERVICIO_ENCUESTA,
} from "./reglas";
import type { FiltrosEncuesta } from "./consultas";

export async function sesionSatisfaccion(accion: "consulta" | "seguimiento" | "admin") {
  const session = await getFullSession();
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const permitido =
    accion === "admin"
      ? puedeAdministrarSatisfaccion(session.rol) && session.rol === "ADMIN"
      : accion === "seguimiento"
        ? puedeRegistrarSeguimiento(session.rol)
        : puedeConsultarSatisfaccion(session.rol);
  if (!permitido || session.rol === "TECNICO") {
    return { ok: false as const, response: NextResponse.json({ error: "Sin acceso" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export function filtrosDesdeUrl(url: URL): FiltrosEncuesta {
  const desde = fechaParam(url, "desde");
  const hasta = fechaParam(url, "hasta");
  const tecnicoId = texto(url, "tecnicoId");
  const tipo = texto(url, "tipoServicio");
  const zona = texto(url, "zona");
  const status = texto(url, "status");
  const solucionado = texto(url, "solucionado");
  const ratingRaw = url.searchParams.get("rating");
  const rating = ratingRaw ? Number(ratingRaw) : undefined;
  return {
    desde,
    hasta: hasta ? new Date(hasta.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined,
    tecnicoId,
    tipoServicio: tipo && (TIPOS_SERVICIO_ENCUESTA as readonly string[]).includes(tipo) ? tipo : undefined,
    zona,
    status: status && (ESTADOS_ENCUESTA as readonly string[]).includes(status) ? status : undefined,
    solucionado:
      solucionado && (SOLUCIONES as readonly string[]).includes(solucionado) ? solucionado : undefined,
    rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
  };
}

export function paginaDesdeUrl(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "25") || 25));
  return { page, pageSize };
}

function texto(url: URL, clave: string) {
  const valor = url.searchParams.get(clave)?.trim();
  return valor || undefined;
}

function fechaParam(url: URL, clave: string) {
  const valor = url.searchParams.get(clave);
  if (!valor) return undefined;
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}
