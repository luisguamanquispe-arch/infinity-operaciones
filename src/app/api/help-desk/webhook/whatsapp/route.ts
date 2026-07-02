import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarCodigoHelpDesk } from "@/lib/help-desk/codigo";
import { buscarClientePorTelefono } from "@/lib/help-desk/cliente-contexto";
import { slaHorasPorPrioridad } from "@/lib/tickets";

/**
 * Webhook WhatsApp Cloud API (entrada).
 * Crea conversación en cola e identifica cliente automáticamente.
 */
export async function POST(request: Request) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];

    if (!msg?.text?.body) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const telefono = msg.from as string;
    const texto = msg.text.body as string;
    const cliente = await buscarClientePorTelefono(telefono);

    const activa = await prisma.hdConversacion.findFirst({
      where: {
        prospectoTelefono: telefono,
        estado: { in: ["EN_COLA", "EN_ATENCION", "EN_ESPERA_CLIENTE"] },
      },
    });

    if (activa) {
      await prisma.hdMensaje.create({
        data: {
          conversacionId: activa.id,
          autor: "CLIENTE",
          contenido: texto,
          metadataJson: JSON.stringify({ whatsappMsgId: msg.id }),
        },
      });
      return NextResponse.json({ ok: true, conversacionId: activa.id });
    }

    const codigo = await generarCodigoHelpDesk();
    const slaHoras = slaHorasPorPrioridad("MEDIA");

    const conv = await prisma.hdConversacion.create({
      data: {
        codigo,
        canal: "WHATSAPP",
        estado: "EN_COLA",
        motivo: texto.slice(0, 200),
        tipoCliente: cliente ? "EXISTENTE" : "PROSPECTO",
        clienteId: cliente?.id,
        prospectoTelefono: telefono,
        prospectoNombre: value?.contacts?.[0]?.profile?.name,
        prioridad: "MEDIA",
        slaVenceEn: new Date(Date.now() + slaHoras * 60 * 60 * 1000),
        mensajes: {
          create: {
            autor: "CLIENTE",
            contenido: texto,
            metadataJson: JSON.stringify({ whatsappMsgId: msg.id }),
          },
        },
      },
    });

    return NextResponse.json({ ok: true, conversacionId: conv.id, codigo });
  } catch (err) {
    console.error("[WhatsApp webhook]", err);
    return NextResponse.json({ error: "Error procesando mensaje" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
