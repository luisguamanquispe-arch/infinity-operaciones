import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { sendSatisfactionSurvey } from "./notificar";
import {
  DIAS_VIGENCIA_ENCUESTA,
  decisionEncuesta,
  esAlertaInsatisfaccion,
  generarTokenEncuesta,
  hashIp,
  httpTrasUpdateRespuesta,
  recortarUserAgent,
  urlEncuestaPublica,
  zonaDeTicket,
  type SolucionValor,
} from "./reglas";

const encuestaPublica = {
  id: true,
  status: true,
  ratingGeneral: true,
  tipoServicio: true,
  openedAt: true,
  answeredAt: true,
  createdAt: true,
} satisfies Prisma.CustomerSatisfactionSurveySelect;

export async function createSatisfactionSurvey(ticketId: string): Promise<
  | { ok: true; creada: boolean; surveyId: string; url: string }
  | { ok: false; motivo: "NO_EXISTE" | "NO_CERRADA" | "SIN_SERVICIO" }
> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      estado: true,
      estadoRevision: true,
      cierrePorJustificacion: true,
      tipo: true,
      clienteId: true,
      tecnicoId: true,
      sectorInfra: true,
      zonaInfra: true,
      cliente: { select: { sector: true } },
      encuestaSatisfaccion: { select: { id: true, token: true } },
    },
  });
  if (!ticket) return { ok: false, motivo: "NO_EXISTE" };

  const decision = decisionEncuesta({
    existe: !!ticket.encuestaSatisfaccion,
    estado: ticket.estado,
    estadoRevision: ticket.estadoRevision,
    cierrePorJustificacion: ticket.cierrePorJustificacion,
  });
  if (decision === "YA_EXISTE" && ticket.encuestaSatisfaccion) {
    return {
      ok: true,
      creada: false,
      surveyId: ticket.encuestaSatisfaccion.id,
      url: urlEncuestaPublica(ticket.encuestaSatisfaccion.token, process.env.PUBLIC_APP_URL),
    };
  }
  if (decision === "NO_CERRADA") return { ok: false, motivo: "NO_CERRADA" };
  if (decision === "SIN_SERVICIO") return { ok: false, motivo: "SIN_SERVICIO" };

  const token = generarTokenEncuesta();
  try {
    const survey = await prisma.customerSatisfactionSurvey.create({
      data: {
        ticketId: ticket.id,
        clienteId: ticket.clienteId,
        tecnicoId: ticket.tecnicoId,
        token,
        tipoServicio: ticket.tipo,
        zona: zonaDeTicket({
          tipo: ticket.tipo,
          sectorCliente: ticket.cliente.sector,
          sectorInfra: ticket.sectorInfra,
          zonaInfra: ticket.zonaInfra,
        }),
        status: "PENDING",
      },
      select: { id: true, token: true },
    });
    await auditar(ticket.id, "SURVEY_CREATED", { surveyId: survey.id });
    return {
      ok: true,
      creada: true,
      surveyId: survey.id,
      url: urlEncuestaPublica(survey.token, process.env.PUBLIC_APP_URL),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existente = await prisma.customerSatisfactionSurvey.findUnique({
        where: { ticketId },
        select: { id: true, token: true },
      });
      if (existente) {
        return {
          ok: true,
          creada: false,
          surveyId: existente.id,
          url: urlEncuestaPublica(existente.token, process.env.PUBLIC_APP_URL),
        };
      }
    }
    throw error;
  }
}

export async function onTicketClosed(ticketId: string): Promise<void> {
  const creada = await createSatisfactionSurvey(ticketId);
  if (!creada.ok || !creada.creada) return;
  await intentarEnvio(creada.surveyId);
}

export async function intentarEnvio(
  surveyId: string,
  origen: "cierre" | "reenvio" = "cierre"
): Promise<{ pendiente: boolean }> {
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      token: true,
      status: true,
      ticketId: true,
      cliente: { select: { nombre: true, telefono: true } },
    },
  });
  if (!survey || survey.status === "ANSWERED" || survey.status === "CANCELLED" || survey.status === "EXPIRED") {
    return { pendiente: false };
  }
  const url = urlEncuestaPublica(survey.token, process.env.PUBLIC_APP_URL);
  let resultado;
  try {
    resultado = await sendSatisfactionSurvey({
      nombre: survey.cliente.nombre,
      telefono: survey.cliente.telefono,
      url,
    });
  } catch {
    await prisma.customerSatisfactionSurvey.update({
      where: { id: survey.id },
      data: {
        status: survey.status === "OPENED" ? "OPENED" : "PENDING",
        deliveryStatus: "FAILED",
      },
    });
    return { pendiente: true };
  }
  if (!resultado.enviado) {
    await prisma.customerSatisfactionSurvey.update({
      where: { id: survey.id },
      data: {
        status: survey.status === "OPENED" ? "OPENED" : "PENDING",
        channel: resultado.canal,
        deliveryStatus: resultado.deliveryStatus,
      },
    });
    if (origen === "reenvio") {
      await auditar(survey.ticketId, "SURVEY_RESENT", {
        surveyId: survey.id,
        deliveryStatus: resultado.deliveryStatus,
      });
    }
    return { pendiente: true };
  }
  await prisma.customerSatisfactionSurvey.update({
    where: { id: survey.id },
    data: {
      status: survey.status === "OPENED" ? "OPENED" : "SENT",
      channel: resultado.canal,
      deliveryStatus: "SENT",
      sentAt: new Date(),
    },
  });
  await auditar(survey.ticketId, origen === "reenvio" ? "SURVEY_RESENT" : "SURVEY_SENT", {
    surveyId: survey.id,
    channel: resultado.canal,
  });
  return { pendiente: false };
}

export async function abrirEncuestaPublica(token: string) {
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { token },
    select: {
      ...encuestaPublica,
      token: true,
      ticketId: true,
    },
  });
  if (!survey) return { ok: false as const, status: 404 };
  const vigente = await expirarSiCorresponde(survey.id, survey.status, survey.createdAt, survey.answeredAt);
  if (!vigente) return { ok: false as const, status: 410 };
  if (survey.status === "ANSWERED") {
    return { ok: true as const, respondida: true, tipoServicio: survey.tipoServicio };
  }
  if (survey.status === "PENDING" || survey.status === "SENT") {
    const abierto = await prisma.customerSatisfactionSurvey.updateMany({
      where: { id: survey.id, status: { in: ["PENDING", "SENT"] } },
      data: { status: "OPENED", openedAt: survey.openedAt ?? new Date() },
    });
    if (abierto.count === 1) {
      await auditar(survey.ticketId, "SURVEY_OPENED", { surveyId: survey.id });
    }
  }
  return { ok: true as const, respondida: false, tipoServicio: survey.tipoServicio };
}

export async function responderEncuestaPublica(input: {
  token: string;
  ratingGeneral: number;
  ratingTecnico: number;
  solucionado: SolucionValor;
  comentario: string | null;
  ip: string;
  userAgent: string | null;
}) {
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { token: input.token },
    select: { id: true, ticketId: true, status: true, createdAt: true, answeredAt: true },
  });
  if (!survey) return { ok: false as const, status: 404 };
  const vigente = await expirarSiCorresponde(survey.id, survey.status, survey.createdAt, survey.answeredAt);
  if (!vigente) return { ok: false as const, status: 410 };
  if (survey.status === "ANSWERED") return { ok: false as const, status: 409 };

  const salt = getEnv().JWT_SECRET;
  const actualizado = await prisma.customerSatisfactionSurvey.updateMany({
    where: {
      id: survey.id,
      status: { in: ["PENDING", "SENT", "OPENED"] },
    },
    data: {
      ratingGeneral: input.ratingGeneral,
      ratingTecnico: input.ratingTecnico,
      solucionado: input.solucionado,
      comentario: input.comentario,
      status: "ANSWERED",
      answeredAt: new Date(),
      ipHash: hashIp(input.ip, salt),
      userAgent: recortarUserAgent(input.userAgent),
    },
  });
  if (httpTrasUpdateRespuesta(actualizado.count) === 409) return { ok: false as const, status: 409 };

  await auditar(survey.ticketId, "SURVEY_ANSWERED", { surveyId: survey.id });
  if (esAlertaInsatisfaccion({ ratingGeneral: input.ratingGeneral, solucionado: input.solucionado })) {
    await auditar(survey.ticketId, "LOW_SATISFACTION_ALERT", {
      surveyId: survey.id,
      ratingGeneral: input.ratingGeneral,
      solucionado: input.solucionado,
    });
  }
  return { ok: true as const };
}

async function expirarSiCorresponde(
  id: string,
  status: string,
  createdAt: Date,
  answeredAt: Date | null
): Promise<boolean> {
  if (status === "CANCELLED" || status === "EXPIRED") return false;
  if (answeredAt || status === "ANSWERED") return true;
  const limite = createdAt.getTime() + DIAS_VIGENCIA_ENCUESTA * 24 * 60 * 60 * 1000;
  if (Date.now() <= limite) return true;
  await prisma.customerSatisfactionSurvey.update({
    where: { id },
    data: { status: "EXPIRED" },
  });
  return false;
}

export async function auditar(
  ticketId: string,
  accion: string,
  metadata: Record<string, string | number | null>
) {
  await prisma.eventoTicket.create({
    data: {
      ticketId,
      accion,
      metadata: JSON.stringify(metadata),
    },
  });
}
