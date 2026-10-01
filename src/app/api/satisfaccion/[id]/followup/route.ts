import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { auditar } from "@/lib/satisfaccion/servicio";
import { sanitizarComentario } from "@/lib/satisfaccion/reglas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("seguimiento");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id },
    select: { id: true, ticketId: true },
  });
  if (!survey) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const motivo = typeof body?.motivo === "string" ? sanitizarComentario(body.motivo).slice(0, 500) : "";
  if (motivo.length < 3) {
    return NextResponse.json({ error: "Indique el motivo del seguimiento" }, { status: 400 });
  }
  const seguimiento = await prisma.satisfactionFollowUp.create({
    data: {
      surveyId: survey.id,
      responsableId: acceso.session.id,
      motivo,
      accion: texto(body?.accion, 1000),
      contacto: texto(body?.contacto, 300),
      resultado: texto(body?.resultado, 1000),
      observaciones: texto(body?.observaciones, 1000),
      status: "OPEN",
    },
  });
  await auditar(survey.ticketId, "SATISFACTION_FOLLOWUP_CREATED", { followUpId: seguimiento.id });
  return NextResponse.json({ ok: true, id: seguimiento.id });
}

function texto(valor: unknown, max: number) {
  if (typeof valor !== "string") return null;
  const limpio = sanitizarComentario(valor).slice(0, max);
  return limpio || null;
}
