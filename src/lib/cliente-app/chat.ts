import { prisma } from "@/lib/prisma";
import { generarCodigoHelpDesk } from "@/lib/help-desk/codigo";
import { slaHorasPorPrioridad } from "@/lib/tickets";
import { generarRespuestaBotCliente } from "./bot-ia";
import { notificarPushClientePorClienteId } from "./push";
import type { ClienteSession } from "./auth";

const ACTIVOS = ["EN_COLA", "EN_ATENCION", "EN_ESPERA_CLIENTE"] as const;

export function serializeMensaje(m: {
  id: string;
  autor: string;
  contenido: string;
  createdAt: Date;
}) {
  return {
    id: m.id,
    autor: m.autor,
    contenido: m.contenido,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeConversacion(c: {
  id: string;
  codigo: string;
  estado: string;
  motivo: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    codigo: c.codigo,
    estado: c.estado,
    motivo: c.motivo,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Obtiene o crea conversación CHAT activa del cliente. */
export async function obtenerOCrearSesionChat(session: ClienteSession) {
  const existente = await prisma.hdConversacion.findFirst({
    where: {
      clienteId: session.clienteId,
      canal: "CHAT",
      estado: { in: [...ACTIVOS] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existente) return existente;

  const codigo = await generarCodigoHelpDesk();
  const slaHoras = slaHorasPorPrioridad("MEDIA");

  const conv = await prisma.hdConversacion.create({
    data: {
      codigo,
      clienteId: session.clienteId,
      canal: "CHAT",
      estado: "EN_ATENCION",
      tipoCliente: "EXISTENTE",
      motivo: "Chat app INFINITY Connect",
      prioridad: "MEDIA",
      slaVenceEn: new Date(Date.now() + slaHoras * 60 * 60 * 1000),
      metadataJson: JSON.stringify({ origen: "infinity_connect" }),
      mensajes: {
        create: {
          autor: "IA",
          contenido:
            "¡Hola! Soy el asistente de Infinity. Cuénteme su consulta o escriba «agente» para hablar con una persona.",
        },
      },
    },
  });

  return conv;
}

export async function listarMensajesChat(
  clienteId: string,
  conversacionId: string,
  after?: string | null
) {
  const conv = await prisma.hdConversacion.findFirst({
    where: { id: conversacionId, clienteId, canal: "CHAT" },
    select: { id: true },
  });
  if (!conv) return null;

  const where: { conversacionId: string; createdAt?: { gt: Date } } = {
    conversacionId,
  };
  if (after) {
    const cursor = await prisma.hdMensaje.findFirst({
      where: { id: after, conversacionId },
      select: { createdAt: true },
    });
    if (cursor) where.createdAt = { gt: cursor.createdAt };
  }

  return prisma.hdMensaje.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, autor: true, contenido: true, createdAt: true },
  });
}

export async function enviarMensajeCliente(opts: {
  session: ClienteSession;
  conversacionId: string;
  contenido: string;
}) {
  const texto = opts.contenido.trim();
  if (texto.length < 1) throw new Error("Mensaje vacío");
  if (texto.length > 4000) throw new Error("Mensaje demasiado largo");

  const conv = await prisma.hdConversacion.findFirst({
    where: {
      id: opts.conversacionId,
      clienteId: opts.session.clienteId,
      canal: "CHAT",
    },
  });
  if (!conv) throw new Error("Conversación no encontrada");
  if (conv.estado === "CERRADO" || conv.estado === "RESUELTO") {
    throw new Error("Esta conversación ya fue cerrada. Abra un chat nuevo.");
  }

  const mensajeCliente = await prisma.hdMensaje.create({
    data: {
      conversacionId: conv.id,
      autor: "CLIENTE",
      usuarioId: opts.session.id,
      contenido: texto,
    },
  });

  const mensajes = await prisma.hdMensaje.findMany({
    where: { conversacionId: conv.id },
    orderBy: { createdAt: "asc" },
    select: { autor: true, contenido: true },
  });

  const tieneAgenteHumano = mensajes.some((m) => m.autor === "AGENTE") || !!conv.asignadoAId;
  const botActivo = !tieneAgenteHumano && conv.estado !== "EN_COLA";

  const creados = [mensajeCliente];

  if (botActivo) {
    const bot = await generarRespuestaBotCliente(mensajes.slice(0, -1), texto);
    const mensajeIa = await prisma.hdMensaje.create({
      data: {
        conversacionId: conv.id,
        autor: "IA",
        contenido: bot.texto,
      },
    });
    creados.push(mensajeIa);

    if (bot.pedirHumano) {
      await prisma.hdMensaje.create({
        data: {
          conversacionId: conv.id,
          autor: "SISTEMA",
          contenido: "Conversación en cola de Help Desk. Un agente le atenderá pronto.",
        },
      });
      await prisma.hdConversacion.update({
        where: { id: conv.id },
        data: { estado: "EN_COLA", updatedAt: new Date() },
      });
    } else {
      await prisma.hdConversacion.update({
        where: { id: conv.id },
        data: { updatedAt: new Date() },
      });
    }
  } else {
    // Cliente escribe mientras espera o habla con agente
    await prisma.hdConversacion.update({
      where: { id: conv.id },
      data: {
        estado: conv.estado === "EN_ESPERA_CLIENTE" ? "EN_ATENCION" : conv.estado,
        updatedAt: new Date(),
      },
    });
  }

  const todos = await prisma.hdMensaje.findMany({
    where: {
      conversacionId: conv.id,
      createdAt: { gte: mensajeCliente.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, autor: true, contenido: true, createdAt: true },
  });

  return { mensajes: todos };
}

/** Llamar cuando un agente responde (Help Desk) para push al cliente. */
export async function onMensajeAgenteParaCliente(conversacionId: string, preview: string) {
  const conv = await prisma.hdConversacion.findUnique({
    where: { id: conversacionId },
    select: { clienteId: true, canal: true, codigo: true },
  });
  if (!conv?.clienteId || conv.canal !== "CHAT") return;

  await notificarPushClientePorClienteId(
    conv.clienteId,
    "Infinity Connect",
    preview.slice(0, 120) || `Nuevo mensaje en ${conv.codigo}`,
    { tipo: "chat", conversacionId, codigo: conv.codigo }
  );
}
