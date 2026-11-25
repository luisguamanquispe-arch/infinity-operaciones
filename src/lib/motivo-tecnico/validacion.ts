import {
  CLIENTE_SITUACIONES,
  MOTIVO_CATEGORIAS,
  MOTIVO_IMPACTOS,
  MOTIVO_PROBLEMAS,
  esTextoGenerico,
  labelDeCatalogo,
  type ClienteSituacionId,
  type MotivoCategoriaId,
  type MotivoImpactoId,
  type MotivoProblemaId,
} from "./catalogo";

export type MotivoEstructuradoInput = {
  categoria?: string | null;
  categoriaOtro?: string | null;
  problema?: string | null;
  problemaOtro?: string | null;
  detalle?: string | null;
  impacto?: string | null;
  observaciones?: string | null;
};

export type MotivoEstructuradoOk = {
  ok: true;
  categoria: MotivoCategoriaId;
  categoriaOtro: string | null;
  problema: MotivoProblemaId;
  problemaOtro: string | null;
  detalle: string;
  impacto: MotivoImpactoId;
  observaciones: string | null;
  /** Texto descriptivo para Ticket.motivo (panel Supervisor). */
  motivoGenerado: string;
};

export type MotivoEstructuradoError = {
  ok: false;
  error: string;
  faltantes: string[];
};

export function validarMotivoEstructurado(
  raw: MotivoEstructuradoInput
): MotivoEstructuradoOk | MotivoEstructuradoError {
  const faltantes: string[] = [];
  const categoria = String(raw.categoria || "").trim() as MotivoCategoriaId;
  const problema = String(raw.problema || "").trim() as MotivoProblemaId;
  const impacto = String(raw.impacto || "").trim() as MotivoImpactoId;
  const detalle = String(raw.detalle || "").trim();
  const categoriaOtro = String(raw.categoriaOtro || "").trim();
  const problemaOtro = String(raw.problemaOtro || "").trim();
  const observaciones = String(raw.observaciones || "").trim() || null;

  if (!MOTIVO_CATEGORIAS.some((c) => c.id === categoria)) {
    faltantes.push("Categoría del soporte");
  }
  if (!MOTIVO_PROBLEMAS.some((c) => c.id === problema)) {
    faltantes.push("Problema reportado");
  }
  if (!MOTIVO_IMPACTOS.some((c) => c.id === impacto)) {
    faltantes.push("Impacto sobre el servicio");
  }
  if (!detalle) {
    faltantes.push("Detalle técnico del problema");
  }

  if (categoria === "OTRO" && categoriaOtro.length < 5) {
    faltantes.push("Especifique la categoría (Otro)");
  }
  if (problema === "OTRO" && problemaOtro.length < 5) {
    faltantes.push("Especifique el problema (Otro)");
  }

  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Falta información obligatoria: ${faltantes.join(", ")}`,
      faltantes,
    };
  }

  if (esTextoGenerico(detalle)) {
    return {
      ok: false,
      error:
        "El detalle técnico es demasiado genérico. Describa el problema con hechos concretos (síntoma, desde cuándo, equipos afectados).",
      faltantes: ["Detalle técnico del problema"],
    };
  }

  if (categoria === "OTRO" && esTextoGenerico(categoriaOtro)) {
    return {
      ok: false,
      error: "Indique una categoría específica en «Otro» (no use textos genéricos).",
      faltantes: ["Especifique la categoría (Otro)"],
    };
  }
  if (problema === "OTRO" && esTextoGenerico(problemaOtro)) {
    return {
      ok: false,
      error: "Indique un problema específico en «Otro» (no use textos genéricos).",
      faltantes: ["Especifique el problema (Otro)"],
    };
  }

  const catLabel =
    categoria === "OTRO"
      ? categoriaOtro
      : labelDeCatalogo(MOTIVO_CATEGORIAS, categoria);
  const probLabel =
    problema === "OTRO" ? problemaOtro : labelDeCatalogo(MOTIVO_PROBLEMAS, problema);
  const impactoLabel = labelDeCatalogo(MOTIVO_IMPACTOS, impacto);

  const motivoGenerado = [
    catLabel,
    probLabel,
    detalle,
    impactoLabel ? `impacto: ${impactoLabel}` : null,
    observaciones,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    ok: true,
    categoria,
    categoriaOtro: categoria === "OTRO" ? categoriaOtro : null,
    problema,
    problemaOtro: problema === "OTRO" ? problemaOtro : null,
    detalle,
    impacto,
    observaciones,
    motivoGenerado,
  };
}

export function validarClienteSituacion(
  raw: string | null | undefined
): { ok: true; situacion: ClienteSituacionId } | { ok: false; error: string } {
  const s = String(raw || "").trim() as ClienteSituacionId;
  if (!CLIENTE_SITUACIONES.some((c) => c.id === s)) {
    return { ok: false, error: "Seleccione la situación del cliente" };
  }
  return { ok: true, situacion: s };
}

export function esIntencionCancelar(situacion: string | null | undefined): boolean {
  return situacion === "INTENCION_CANCELAR";
}

/** Prioridad sugerida según impacto / riesgo (no sobrescribe tickets antiguos). */
export function prioridadSugeridaPorImpacto(
  impacto: MotivoImpactoId,
  riesgoBaja: boolean
): "ALTA" | "MEDIA" | "BAJA" {
  if (riesgoBaja || impacto === "URGENTE_RIESGO" || impacto === "TOTAL_DOMICILIO") {
    return "ALTA";
  }
  if (impacto === "PARCIAL") return "MEDIA";
  return "BAJA";
}

/** Alerta activa: flag explícito y sin gestión «Cliente recuperado». */
export function alertaRiesgoBajaActiva(ticket: {
  clienteRiesgoBaja: boolean;
  clienteRiesgoBajaResueltoEn: Date | string | null;
}): boolean {
  return ticket.clienteRiesgoBaja && !ticket.clienteRiesgoBajaResueltoEn;
}
