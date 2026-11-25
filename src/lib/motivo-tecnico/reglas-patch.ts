import { enMayusculasGuardar } from "@/lib/mayusculas";
import { alertaRiesgoBajaActiva, validarMotivoEstructurado } from "./validacion";

export type TicketMotivoSnapshot = {
  motivo: string | null;
  descripcion: string | null;
  motivoCategoria: string | null;
  motivoCategoriaOtro: string | null;
  motivoProblema: string | null;
  motivoProblemaOtro: string | null;
  motivoDetalle: string | null;
  motivoImpacto: string | null;
  motivoObservaciones: string | null;
  clienteRiesgoBaja: boolean;
  clienteRiesgoBajaResueltoEn: Date | string | null;
  prioridad: string;
};

export function ticketTieneMotivoEstructurado(ticket: {
  motivoCategoria?: string | null;
}): boolean {
  return Boolean(ticket.motivoCategoria && String(ticket.motivoCategoria).trim());
}

export function rolPuedeGestionarRiesgoBaja(rol: string | null | undefined): boolean {
  return rol === "SUPERVISOR" || rol === "ADMIN";
}

/** Campos de control de riesgo que PATCH nunca debe aceptar del body. */
export const CAMPOS_RIESGO_PROHIBIDOS_PATCH = [
  "clienteRiesgoBaja",
  "clienteRiesgoBajaMotivo",
  "clienteRiesgoBajaActivadoEn",
  "clienteRiesgoBajaActivadoPorId",
  "clienteRiesgoBajaResueltoEn",
  "clienteRiesgoBajaResueltoPorId",
  "clienteSituacion",
] as const;

export function bodyIntentaMutarRiesgo(body: Record<string, unknown>): boolean {
  return CAMPOS_RIESGO_PROHIBIDOS_PATCH.some((k) => body[k] !== undefined);
}

/**
 * Si el riesgo está activo, solo se permite mantener o subir a ALTA (ya es ALTA).
 * Cualquier intento de MEDIA/BAJA se rechaza.
 */
export function validarPrioridadConRiesgoActivo(opts: {
  ticket: Pick<
    TicketMotivoSnapshot,
    "clienteRiesgoBaja" | "clienteRiesgoBajaResueltoEn" | "prioridad"
  >;
  prioridadNueva: string | null | undefined;
}): { ok: true; prioridad: string | null } | { ok: false; error: string } {
  const riesgoActivo = alertaRiesgoBajaActiva({
    clienteRiesgoBaja: opts.ticket.clienteRiesgoBaja,
    clienteRiesgoBajaResueltoEn: opts.ticket.clienteRiesgoBajaResueltoEn,
  });
  if (!riesgoActivo) {
    return {
      ok: true,
      prioridad: opts.prioridadNueva ? String(opts.prioridadNueva) : null,
    };
  }
  if (!opts.prioridadNueva || opts.prioridadNueva === opts.ticket.prioridad) {
    return { ok: true, prioridad: null };
  }
  if (opts.prioridadNueva !== "ALTA") {
    return {
      ok: false,
      error:
        "No se puede reducir la prioridad mientras el cliente está en riesgo de baja activo. Debe permanecer en ALTA.",
    };
  }
  return { ok: true, prioridad: "ALTA" };
}

export type MotivoPatchBody = {
  motivo?: unknown;
  descripcion?: unknown;
  motivoCategoria?: unknown;
  motivoCategoriaOtro?: unknown;
  motivoProblema?: unknown;
  motivoProblemaOtro?: unknown;
  motivoDetalle?: unknown;
  motivoImpacto?: unknown;
  motivoObservaciones?: unknown;
};

export type MotivoPatchResult =
  | { ok: true; update: Record<string, unknown> }
  | { ok: false; error: string; faltantes?: string[] };

function bodyTraeCamposEstructurados(body: MotivoPatchBody): boolean {
  return (
    body.motivoCategoria !== undefined ||
    body.motivoProblema !== undefined ||
    body.motivoDetalle !== undefined ||
    body.motivoImpacto !== undefined ||
    body.motivoObservaciones !== undefined ||
    body.motivoCategoriaOtro !== undefined ||
    body.motivoProblemaOtro !== undefined
  );
}

/**
 * Resuelve actualización de motivo/descripcion para PATCH.
 * - Estructurado: solo vía campos estructurados validados; regenera `motivo`.
 * - Legacy: permite motivo/descripcion libres solo si el body los envía explícitamente
 *   con intención de cambio (comparar con actuales lo hace el caller al decidir enviar).
 * - Si ticket estructurado y solo llega motivo libre → se ignora (no desincroniza).
 */
export function resolverMotivoEnPatch(
  ticket: TicketMotivoSnapshot,
  body: MotivoPatchBody
): MotivoPatchResult {
  const estructurado = ticketTieneMotivoEstructurado(ticket);
  const traeEstructurado = bodyTraeCamposEstructurados(body);

  if (estructurado || traeEstructurado) {
    if (!traeEstructurado) {
      // Ignorar motivo/descripcion libres: no sobrescribir motivo generado.
      const update: Record<string, unknown> = {};
      if (body.descripcion !== undefined) {
        const d = String(body.descripcion ?? "").trim();
        update.descripcion = d ? enMayusculasGuardar(d) : null;
      }
      return { ok: true, update };
    }

    const val = validarMotivoEstructurado({
      categoria:
        body.motivoCategoria !== undefined
          ? String(body.motivoCategoria ?? "")
          : ticket.motivoCategoria,
      categoriaOtro:
        body.motivoCategoriaOtro !== undefined
          ? String(body.motivoCategoriaOtro ?? "")
          : ticket.motivoCategoriaOtro,
      problema:
        body.motivoProblema !== undefined
          ? String(body.motivoProblema ?? "")
          : ticket.motivoProblema,
      problemaOtro:
        body.motivoProblemaOtro !== undefined
          ? String(body.motivoProblemaOtro ?? "")
          : ticket.motivoProblemaOtro,
      detalle:
        body.motivoDetalle !== undefined
          ? String(body.motivoDetalle ?? "")
          : ticket.motivoDetalle,
      impacto:
        body.motivoImpacto !== undefined
          ? String(body.motivoImpacto ?? "")
          : ticket.motivoImpacto,
      observaciones:
        body.motivoObservaciones !== undefined
          ? String(body.motivoObservaciones ?? "")
          : ticket.motivoObservaciones,
    });
    if (!val.ok) {
      return { ok: false, error: val.error, faltantes: val.faltantes };
    }

    const update: Record<string, unknown> = {
      motivo: enMayusculasGuardar(val.motivoGenerado),
      motivoCategoria: val.categoria,
      motivoCategoriaOtro: val.categoriaOtro
        ? enMayusculasGuardar(val.categoriaOtro)
        : null,
      motivoProblema: val.problema,
      motivoProblemaOtro: val.problemaOtro
        ? enMayusculasGuardar(val.problemaOtro)
        : null,
      motivoDetalle: enMayusculasGuardar(val.detalle),
      motivoImpacto: val.impacto,
      motivoObservaciones: val.observaciones
        ? enMayusculasGuardar(val.observaciones)
        : null,
    };
    if (body.descripcion !== undefined) {
      const d = String(body.descripcion ?? "").trim();
      update.descripcion = d ? enMayusculasGuardar(d) : enMayusculasGuardar(val.detalle);
    }
    return { ok: true, update };
  }

  // Ticket legacy: solo aplicar motivo/descripcion si vienen en el body.
  const update: Record<string, unknown> = {};
  if (body.motivo !== undefined) {
    const m = String(body.motivo ?? "").trim();
    update.motivo = m ? enMayusculasGuardar(m) : null;
  }
  if (body.descripcion !== undefined) {
    const d = String(body.descripcion ?? "").trim();
    update.descripcion = d ? enMayusculasGuardar(d) : null;
  }
  return { ok: true, update };
}

export function validarObservacionesRecuperacion(
  observaciones: string | null | undefined
): { ok: true; texto: string } | { ok: false; error: string } {
  const t = String(observaciones || "").trim();
  if (t.length < 8) {
    return {
      ok: false,
      error:
        "Para marcar «Cliente recuperado» indique observaciones que documenten el resultado (mín. 8 caracteres).",
    };
  }
  return { ok: true, texto: t };
}
