import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  esAlertaInsatisfaccion,
  redondear,
  resumenDesdeConteos,
} from "./reglas";

export type FiltrosEncuesta = {
  desde?: Date;
  hasta?: Date;
  tecnicoId?: string;
  tipoServicio?: string;
  zona?: string;
  status?: string;
  rating?: number;
  solucionado?: string;
  codigo?: string;
};

export function whereEncuesta(f: FiltrosEncuesta): Prisma.CustomerSatisfactionSurveyWhereInput {
  const where: Prisma.CustomerSatisfactionSurveyWhereInput = {};
  if (f.desde || f.hasta) {
    where.createdAt = {};
    if (f.desde) where.createdAt.gte = f.desde;
    if (f.hasta) where.createdAt.lte = f.hasta;
  }
  if (f.tecnicoId) where.tecnicoId = f.tecnicoId;
  if (f.tipoServicio) where.tipoServicio = f.tipoServicio;
  if (f.zona) where.zona = f.zona;
  if (f.status) where.status = f.status as Prisma.CustomerSatisfactionSurveyWhereInput["status"];
  if (f.rating) where.ratingGeneral = f.rating;
  if (f.solucionado) {
    where.solucionado = f.solucionado as Prisma.CustomerSatisfactionSurveyWhereInput["solucionado"];
  }
  if (f.codigo) where.ticket = { codigo: { contains: f.codigo, mode: "insensitive" } };
  return where;
}

const selectLista = {
  id: true,
  ticketId: true,
  tipoServicio: true,
  zona: true,
  ratingGeneral: true,
  ratingTecnico: true,
  solucionado: true,
  comentario: true,
  status: true,
  channel: true,
  deliveryStatus: true,
  sentAt: true,
  openedAt: true,
  answeredAt: true,
  createdAt: true,
  cliente: { select: { id: true, nombre: true } },
  tecnico: { select: { id: true, usuario: { select: { nombre: true } } } },
  ticket: { select: { codigo: true } },
  seguimientos: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, status: true },
  },
};

export async function listarEncuestas(f: FiltrosEncuesta, page: number, pageSize: number) {
  const where = whereEncuesta(f);
  const skip = Math.max(0, (page - 1) * pageSize);
  const [total, filas] = await Promise.all([
    prisma.customerSatisfactionSurvey.count({ where }),
    prisma.customerSatisfactionSurvey.findMany({
      where,
      select: selectLista,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  return { total, page, pageSize, filas };
}

export async function dashboardSatisfaccion(f: FiltrosEncuesta) {
  const where = whereEncuesta(f);
  const [base, porTecnico, porServicio, porZona, comentarios] = await Promise.all([
    conteos(where),
    desglose(where, "tecnicoId"),
    desglose(where, "tipoServicio"),
    desglose(where, "zona"),
    prisma.customerSatisfactionSurvey.groupBy({
      by: ["comentario"],
      where: { AND: [where, { status: "ANSWERED", comentario: { not: null } }] },
      _count: { _all: true },
    }),
  ]);
  const resumen = resumenDesdeConteos(base);
  const nombres = await nombresTecnicos([...porTecnico.keys()]);
  const tecnicos = [...porTecnico.entries()].map(([id, conteo]) => {
    const item = resumenDesdeConteos(conteo);
    return {
      tecnicoId: id || null,
      tecnico: (id && nombres.get(id)) || "Sin técnico",
      ...presentar(item),
    };
  });
  const servicios = [...porServicio.entries()].map(([tipoServicio, conteo]) => ({
    tipoServicio: tipoServicio || "Sin servicio",
    ...presentar(resumenDesdeConteos(conteo)),
  }));
  const zonas = [...porZona.entries()].map(([zona, conteo]) => ({
    zona: zona || "Sin zona",
    ...presentar(resumenDesdeConteos(conteo)),
  }));
  const bajas = (base.porRating[1] || 0) + (base.porRating[2] || 0);
  const noSolucionadas = base.porSolucion.NO || 0;
  const peor = <T extends { csat: number | null; respuestas: number; muestra: string }>(lista: T[]) =>
    [...lista]
      .filter((item) => item.muestra === "SUFICIENTE" && item.csat != null)
      .sort((a, b) => (a.csat ?? 0) - (b.csat ?? 0))[0] || null;
  const servicio = peor(servicios);
  const zona = peor(zonas);
  return {
    kpis: {
      csat: presentar(resumen).csat,
      enviadas: resumen.enviadas,
      respondidas: resumen.respuestas,
      tasaRespuesta: presentar(resumen).tasaRespuesta,
      promedio: presentar(resumen).promedio,
      total: resumen.encuestas,
      pendientes: base.porEstado.PENDING || 0,
      solucion: presentar(resumen).solucion,
    },
    distribucion: resumen.distribucion.map((item) => ({
      ...item,
      pct: redondear(item.pct, 1) ?? 0,
    })),
    porTecnico: tecnicos,
    porServicio: servicios,
    porZona: zonas,
    oportunidades: {
      muestraMinima: 10,
      servicioMenorCsat: servicio
        ? { tipoServicio: servicio.tipoServicio, csat: servicio.csat, respuestas: servicio.respuestas }
        : null,
      zonaMenorCsat: zona ? { zona: zona.zona, csat: zona.csat, respuestas: zona.respuestas } : null,
      pctNoSolucionado: redondear(
        resumen.respuestas === 0 ? null : (noSolucionadas / resumen.respuestas) * 100,
        2
      ),
      pctCalificacionBaja: redondear(
        resumen.respuestas === 0 ? null : (bajas / resumen.respuestas) * 100,
        2
      ),
      tecnicosRepresentativos: tecnicos
        .filter((item) => item.muestra === "SUFICIENTE")
        .map((item) => ({ tecnico: item.tecnico, csat: item.csat, respuestas: item.respuestas })),
    },
    comentariosFrecuentes: comentarios
      .map((fila) => ({ texto: (fila.comentario || "").trim(), veces: fila._count._all }))
      .filter((fila) => fila.texto.length >= 8 && fila.veces >= 2)
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 8),
    nota: "Indicadores operativos para identificar oportunidades de mejora. No constituyen una evaluación laboral.",
  };
}

export async function alertasInsatisfaccion(page: number, pageSize: number) {
  const where: Prisma.CustomerSatisfactionSurveyWhereInput = {
    status: "ANSWERED",
    OR: [{ ratingGeneral: { lte: 2 } }, { solucionado: "NO" }],
  };
  const skip = Math.max(0, (page - 1) * pageSize);
  const [total, filas] = await Promise.all([
    prisma.customerSatisfactionSurvey.count({ where }),
    prisma.customerSatisfactionSurvey.findMany({
      where,
      orderBy: { answeredAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        ratingGeneral: true,
        solucionado: true,
        comentario: true,
        tipoServicio: true,
        answeredAt: true,
        cliente: { select: { nombre: true } },
        tecnico: { select: { usuario: { select: { nombre: true } } } },
        ticket: { select: { codigo: true } },
        seguimientos: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, motivo: true },
        },
      },
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    filas: filas.filter((fila) =>
      esAlertaInsatisfaccion({ ratingGeneral: fila.ratingGeneral, solucionado: fila.solucionado })
    ),
  };
}

export async function comparativoMensual(referencia = new Date()) {
  const actual = rangoMes(referencia, 0);
  const anterior = rangoMes(referencia, -1);
  const mismoAnterior = rangoMes(new Date(referencia.getFullYear() - 1, referencia.getMonth(), 1), 0);
  const [a, b, c] = await Promise.all([
    metricasPeriodo(actual),
    metricasPeriodo(anterior),
    metricasPeriodo(mismoAnterior),
  ]);
  return {
    columnas: [etiquetaMes(anterior.desde), etiquetaMes(actual.desde), etiquetaMes(mismoAnterior.desde)],
    periodos: { anterior: b, actual: a, mismoMesAnterior: c },
  };
}

async function metricasPeriodo(rango: { desde: Date; hasta: Date }) {
  const resumen = presentar(
    resumenDesdeConteos(await conteos({ createdAt: { gte: rango.desde, lt: rango.hasta } }))
  );
  return {
    desde: rango.desde.toISOString(),
    hasta: rango.hasta.toISOString(),
    otEncuestas: resumen.encuestas,
    enviadas: resumen.enviadas,
    respondidas: resumen.respuestas,
    tasaRespuesta: resumen.tasaRespuesta,
    promedio: resumen.promedio,
    csat: resumen.csat,
    solucion: resumen.solucion,
    distribucion: resumen.distribucion,
  };
}

function rangoMes(base: Date, delta: number) {
  const desde = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  const hasta = new Date(desde.getFullYear(), desde.getMonth() + 1, 1);
  return { desde, hasta };
}

function etiquetaMes(fecha: Date) {
  return fecha.toLocaleDateString("es-EC", { month: "short", year: "numeric" });
}

export async function datosExportacion(f: FiltrosEncuesta) {
  const where = whereEncuesta(f);
  const [filas, abiertos, cerrados, resumen, insatisfechos] = await Promise.all([
    prisma.customerSatisfactionSurvey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        tipoServicio: true,
        zona: true,
        status: true,
        ratingGeneral: true,
        ratingTecnico: true,
        solucionado: true,
        comentario: true,
        createdAt: true,
        answeredAt: true,
        cliente: { select: { nombre: true } },
        tecnico: { select: { usuario: { select: { nombre: true } } } },
        ticket: { select: { codigo: true } },
        seguimientos: { select: { status: true } },
      },
    }),
    prisma.satisfactionFollowUp.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, survey: where },
    }),
    prisma.satisfactionFollowUp.count({
      where: { status: "RESOLVED", survey: where },
    }),
    conteos(where).then((conteo) => presentar(resumenDesdeConteos(conteo))),
    prisma.customerSatisfactionSurvey.count({
      where: {
        AND: [where, { status: "ANSWERED", OR: [{ ratingGeneral: { lte: 2 } }, { solucionado: "NO" }] }],
      },
    }),
  ]);
  return { filas, resumen, distribucion: resumen.distribucion, abiertos, cerrados, insatisfechos };
}

type Conteos = {
  total: number;
  porEstado: Record<string, number>;
  porRating: Record<number, number>;
  porSolucion: Record<string, number>;
};

async function conteos(where: Prisma.CustomerSatisfactionSurveyWhereInput): Promise<Conteos> {
  const respondidas: Prisma.CustomerSatisfactionSurveyWhereInput = { AND: [where, { status: "ANSWERED" }] };
  const [total, estados, ratings, soluciones] = await Promise.all([
    prisma.customerSatisfactionSurvey.count({ where }),
    prisma.customerSatisfactionSurvey.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.customerSatisfactionSurvey.groupBy({
      by: ["ratingGeneral"],
      where: { AND: [respondidas, { ratingGeneral: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.customerSatisfactionSurvey.groupBy({
      by: ["solucionado"],
      where: respondidas,
      _count: { _all: true },
    }),
  ]);
  const porEstado: Record<string, number> = {};
  for (const fila of estados) porEstado[fila.status] = fila._count._all;
  const porRating: Record<number, number> = {};
  for (const fila of ratings) {
    if (fila.ratingGeneral != null) porRating[fila.ratingGeneral] = fila._count._all;
  }
  const porSolucion: Record<string, number> = {};
  for (const fila of soluciones) {
    if (fila.solucionado) porSolucion[fila.solucionado] = fila._count._all;
  }
  return { total, porEstado, porRating, porSolucion };
}

async function desglose(
  where: Prisma.CustomerSatisfactionSurveyWhereInput,
  campo: "tecnicoId" | "tipoServicio" | "zona"
) {
  const respondidas: Prisma.CustomerSatisfactionSurveyWhereInput = { AND: [where, { status: "ANSWERED" }] };
  const [estados, ratings, soluciones] = await Promise.all([
    prisma.customerSatisfactionSurvey.groupBy({ by: [campo, "status"], where, _count: { _all: true } }),
    prisma.customerSatisfactionSurvey.groupBy({
      by: [campo, "ratingGeneral"],
      where: { AND: [respondidas, { ratingGeneral: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.customerSatisfactionSurvey.groupBy({
      by: [campo, "solucionado"],
      where: respondidas,
      _count: { _all: true },
    }),
  ]);
  const mapa = new Map<string, Conteos>();
  const asegurar = (clave: string | null) => {
    const id = clave || "";
    let item = mapa.get(id);
    if (!item) {
      item = { total: 0, porEstado: {}, porRating: {}, porSolucion: {} };
      mapa.set(id, item);
    }
    return item;
  };
  for (const fila of estados) {
    const item = asegurar(fila[campo]);
    item.porEstado[fila.status] = fila._count._all;
    item.total += fila._count._all;
  }
  for (const fila of ratings) {
    if (fila.ratingGeneral == null) continue;
    asegurar(fila[campo]).porRating[fila.ratingGeneral] = fila._count._all;
  }
  for (const fila of soluciones) {
    if (!fila.solucionado) continue;
    asegurar(fila[campo]).porSolucion[fila.solucionado] = fila._count._all;
  }
  return mapa;
}

function presentar<T extends { promedio: number | null; csat: number | null; solucion: number | null; tasaRespuesta: number | null; distribucion: { estrella: number; cantidad: number; pct: number }[] }>(
  resumen: T
): T {
  return {
    ...resumen,
    promedio: redondear(resumen.promedio, 2),
    csat: redondear(resumen.csat, 2),
    solucion: redondear(resumen.solucion, 2),
    tasaRespuesta: redondear(resumen.tasaRespuesta, 2),
    distribucion: resumen.distribucion.map((item) => ({ ...item, pct: redondear(item.pct, 1) ?? 0 })),
  };
}

async function nombresTecnicos(ids: string[]) {
  const validos = ids.filter(Boolean);
  const filas = validos.length
    ? await prisma.tecnico.findMany({
        where: { id: { in: validos } },
        select: { id: true, usuario: { select: { nombre: true } } },
      })
    : [];
  return new Map(filas.map((fila) => [fila.id, fila.usuario.nombre]));
}
