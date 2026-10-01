import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { auditar } from "@/lib/satisfaccion/servicio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id },
    select: {
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
      cliente: { select: { nombre: true } },
      tecnico: { select: { usuario: { select: { nombre: true } } } },
      ticket: { select: { codigo: true, estado: true, estadoRevision: true } },
      seguimientos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!survey) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  return NextResponse.json(survey);
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("admin");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id },
    select: { id: true, ticketId: true, status: true },
  });
  if (!survey) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  if (survey.status === "ANSWERED") {
    return NextResponse.json({ error: "Una respuesta no se puede cancelar" }, { status: 409 });
  }
  await prisma.customerSatisfactionSurvey.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await auditar(survey.ticketId, "SURVEY_CANCELLED", { surveyId: survey.id });
  return NextResponse.json({ ok: true });
}
