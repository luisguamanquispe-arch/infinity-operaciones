import { createHash, randomBytes } from "crypto";
import { COMENTARIO_MAX, MUESTRA_MINIMA, SOLUCIONES, type SolucionValor } from "./constantes";

export {
  COMENTARIO_MAX,
  MUESTRA_MINIMA,
  DIAS_VIGENCIA_ENCUESTA,
  SOLUCIONES,
  ESTADOS_ENCUESTA,
  TIPOS_SERVICIO_ENCUESTA,
  type SolucionValor,
} from "./constantes";

const ROLES_LECTURA = new Set(["ADMIN", "SUPERVISOR"]);

export function puedeConsultarSatisfaccion(rol: string | null | undefined): boolean {
  return !!rol && ROLES_LECTURA.has(rol);
}

export function puedeAdministrarSatisfaccion(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

/** El técnico no modifica ni elimina resultados. El cliente entra solo con token. */
export function puedeMutarEncuesta(rol: string | null | undefined): boolean {
  return rol === "ADMIN";
}

export function puedeRegistrarSeguimiento(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

export type DecisionEncuesta = "CREAR" | "NO_CERRADA" | "YA_EXISTE" | "SIN_SERVICIO";

export function decisionEncuesta(input: {
  existe: boolean;
  estado: string;
  estadoRevision: string | null | undefined;
  cierrePorJustificacion: boolean;
}): DecisionEncuesta {
  if (input.existe) return "YA_EXISTE";
  if (input.cierrePorJustificacion) return "SIN_SERVICIO";
  if (input.estado === "CERRADO" && input.estadoRevision === "APROBADO") return "CREAR";
  return "NO_CERRADA";
}

export function generarTokenEncuesta(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenEncuestaValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function origenPublico(publicAppUrl: string | undefined): string {
  const raw = publicAppUrl?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function urlEncuestaPublica(token: string, publicAppUrl: string | undefined): string {
  const origin = origenPublico(publicAppUrl);
  const path = `/satisfaccion/${token}`;
  return origin ? `${origin}${path}` : path;
}

export function zonaDeTicket(input: {
  tipo: string;
  sectorCliente: string | null | undefined;
  sectorInfra: string | null | undefined;
  zonaInfra: string | null | undefined;
}): string | null {
  if (input.tipo === "INFRAESTRUCTURA") {
    const zona = input.sectorInfra?.trim() || input.zonaInfra?.trim();
    return zona || null;
  }
  const sector = input.sectorCliente?.trim();
  return sector || null;
}

export function mensajeWhatsappSatisfaccion(nombre: string, url: string): string {
  const quien = nombre.trim() || "cliente";
  return [
    `Hola ${quien}.`,
    "",
    "Gracias por permitirnos atenderte.",
    "",
    "Queremos conocer cómo fue tu experiencia con nuestro servicio técnico.",
    "",
    "Tu opinión nos ayuda a mejorar.",
    "",
    "Califica tu servicio aquí:",
    "",
    url,
  ].join("\n");
}

export type ErrorRespuesta = { campo: string; mensaje: string };

export function validarRespuestaEncuesta(body: unknown): {
  ok: true;
  ratingGeneral: number;
  ratingTecnico: number;
  solucionado: SolucionValor;
  comentario: string | null;
} | { ok: false; errores: ErrorRespuesta[] } {
  const errores: ErrorRespuesta[] = [];
  if (!body || typeof body !== "object") {
    return { ok: false, errores: [{ campo: "body", mensaje: "Datos inválidos" }] };
  }
  const data = body as Record<string, unknown>;
  const prohibidos = [
    "ticketId",
    "tecnicoId",
    "clienteId",
    "csat",
    "createdAt",
    "answeredAt",
    "status",
    "token",
    "ipHash",
  ];
  if (prohibidos.some((campo) => campo in data)) {
    errores.push({
      campo: "body",
      mensaje: "No se aceptan identificadores, fechas ni métricas calculadas",
    });
  }
  const ratingGeneral = numeroEstrella(data.ratingGeneral);
  const ratingTecnico = numeroEstrella(data.ratingTecnico);
  if (ratingGeneral == null) {
    errores.push({ campo: "ratingGeneral", mensaje: "La calificación general debe ser de 1 a 5" });
  }
  if (ratingTecnico == null) {
    errores.push({ campo: "ratingTecnico", mensaje: "La calificación del técnico debe ser de 1 a 5" });
  }
  const sol = data.solucionado;
  if (typeof sol !== "string" || !SOLUCIONES.includes(sol as SolucionValor)) {
    errores.push({ campo: "solucionado", mensaje: "Indique si el requerimiento fue solucionado" });
  }
  let comentario: string | null = null;
  if (data.comentario != null && data.comentario !== "") {
    if (typeof data.comentario !== "string") {
      errores.push({ campo: "comentario", mensaje: "El comentario no es válido" });
    } else {
      const limpio = sanitizarComentario(data.comentario);
      if (limpio.length > COMENTARIO_MAX) {
        errores.push({
          campo: "comentario",
          mensaje: `El comentario admite hasta ${COMENTARIO_MAX} caracteres`,
        });
      } else {
        comentario = limpio.length ? limpio : null;
      }
    }
  }
  if (errores.length || ratingGeneral == null || ratingTecnico == null || typeof sol !== "string") {
    return { ok: false, errores };
  }
  return {
    ok: true,
    ratingGeneral,
    ratingTecnico,
    solucionado: sol as SolucionValor,
    comentario,
  };
}

export function sanitizarComentario(texto: string): string {
  return texto.replace(/<[^>]*>/g, "").replace(/\u0000/g, "").trim();
}

function numeroEstrella(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export function calcularCsat(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const favorables = ratings.filter((r) => r === 4 || r === 5).length;
  return (favorables / ratings.length) * 100;
}

export function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((a, b) => a + b, 0);
  return suma / valores.length;
}

export function tasa(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return (parte / total) * 100;
}

export function redondear(valor: number | null, decimales = 1): number | null {
  if (valor == null || Number.isNaN(valor)) return null;
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

export function distribucionEstrellas(ratings: number[]): { estrella: number; cantidad: number; pct: number }[] {
  const total = ratings.length;
  return [5, 4, 3, 2, 1].map((estrella) => {
    const cantidad = ratings.filter((r) => r === estrella).length;
    return {
      estrella,
      cantidad,
      pct: total === 0 ? 0 : Math.round((cantidad / total) * 1000) / 10,
    };
  });
}

export function esAlertaInsatisfaccion(input: {
  ratingGeneral: number | null;
  solucionado: string | null;
}): boolean {
  if (input.ratingGeneral != null && input.ratingGeneral <= 2) return true;
  return input.solucionado === "NO";
}

export function pctSolucionadoCompleto(valores: (string | null)[]): number | null {
  const respondidos = valores.filter((v) => v != null);
  if (respondidos.length === 0) return null;
  const ok = respondidos.filter((v) => v === "COMPLETAMENTE").length;
  return (ok / respondidos.length) * 100;
}

export function muestraSuficiente(respuestas: number): boolean {
  return respuestas >= MUESTRA_MINIMA;
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex");
}

export function recortarUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  const limpio = ua.replace(/[\u0000-\u001f]/g, "").trim();
  if (!limpio) return null;
  return limpio.slice(0, 180);
}

export type FilaMetrica = {
  tipoServicio: string;
  zona: string | null;
  tecnicoId: string | null;
  tecnicoNombre: string | null;
  ratingGeneral: number | null;
  solucionado: string | null;
  comentario: string | null;
  status: string;
};

export function resumirGrupo(
  filas: { ratingGeneral: number | null; solucionado: string | null; status: string }[]
) {
  const respuestas = filas.filter((f) => f.status === "ANSWERED" && f.ratingGeneral != null);
  const ratings = respuestas.map((f) => f.ratingGeneral as number);
  const enviadas = filas.filter((f) => f.status === "SENT" || f.status === "OPENED" || f.status === "ANSWERED").length;
  return {
    encuestas: filas.length,
    enviadas,
    respuestas: respuestas.length,
    promedio: redondear(promedio(ratings), 2),
    csat: redondear(calcularCsat(ratings), 1),
    solucion: redondear(
      pctSolucionadoCompleto(respuestas.map((f) => f.solucionado)),
      1
    ),
    tasaRespuesta: redondear(tasa(respuestas.length, enviadas), 1),
    muestra: muestraSuficiente(respuestas.length) ? "SUFICIENTE" : "MUESTRA_INSUFICIENTE",
  };
}

export function comentariosRepetidos(textos: (string | null)[], minimo = 2): { texto: string; veces: number }[] {
  const map = new Map<string, { texto: string; veces: number }>();
  for (const raw of textos) {
    if (!raw) continue;
    const texto = raw.trim();
    if (texto.length < 8) continue;
    const key = texto.toLocaleLowerCase("es");
    const prev = map.get(key);
    if (prev) prev.veces += 1;
    else map.set(key, { texto, veces: 1 });
  }
  return [...map.values()].filter((c) => c.veces >= minimo).sort((a, b) => b.veces - a.veces).slice(0, 8);
}

/** Si el envío falla, la OT no se reabre y la encuesta sigue pendiente. */
export function estadoTrasFalloEnvio(): "PENDING" {
  return "PENDING";
}

/** Una sola fila actualizada gana. El resto de la carrera responde 409. */
export function httpTrasUpdateRespuesta(filasActualizadas: number): 200 | 409 {
  return filasActualizadas === 1 ? 200 : 409;
}

export function resumenDesdeConteos(input: {
  total: number;
  porEstado: Record<string, number>;
  porRating: Record<number, number>;
  porSolucion: Record<string, number>;
}) {
  const enviadas =
    (input.porEstado.SENT || 0) + (input.porEstado.OPENED || 0) + (input.porEstado.ANSWERED || 0);
  let respuestas = 0;
  let suma = 0;
  let favorables = 0;
  for (const [estrella, cantidad] of Object.entries(input.porRating)) {
    const nota = Number(estrella);
    respuestas += cantidad;
    suma += nota * cantidad;
    if (nota === 4 || nota === 5) favorables += cantidad;
  }
  const conSolucion = Object.values(input.porSolucion).reduce((acc, n) => acc + n, 0);
  const completas = input.porSolucion.COMPLETAMENTE || 0;
  return {
    encuestas: input.total,
    enviadas,
    respuestas,
    promedio: respuestas === 0 ? null : suma / respuestas,
    csat: respuestas === 0 ? null : (favorables / respuestas) * 100,
    solucion: conSolucion === 0 ? null : (completas / conSolucion) * 100,
    tasaRespuesta: tasa(respuestas, enviadas),
    muestra: muestraSuficiente(respuestas) ? ("SUFICIENTE" as const) : ("MUESTRA_INSUFICIENTE" as const),
    distribucion: [5, 4, 3, 2, 1].map((estrella) => {
      const cantidad = input.porRating[estrella] || 0;
      return {
        estrella,
        cantidad,
        pct: respuestas === 0 ? 0 : (cantidad / respuestas) * 100,
      };
    }),
  };
}
