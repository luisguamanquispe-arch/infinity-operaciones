import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vapidPublicKey } from "@/lib/recordatorios/push";
import {
  desactivarSuscripcionPush,
  registrarSuscripcionPush,
} from "@/lib/recordatorios/suscripcion";

export const runtime = "nodejs";

async function requireTecnico() {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO" || !session.tecnicoId) return null;
  return session;
}

export async function GET() {
  const session = await requireTecnico();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({
    publicKey: vapidPublicKey(),
    disponible: Boolean(vapidPublicKey()),
  });
}

export async function POST(request: Request) {
  const session = await requireTecnico();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = body.endpoint?.trim() ?? "";
  const p256dh = body.keys?.p256dh?.trim() ?? "";
  const auth = body.keys?.auth?.trim() ?? "";
  if (!endpoint.startsWith("https://") || p256dh.length < 20 || auth.length < 10) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }
  const ua = request.headers.get("user-agent")?.slice(0, 180) ?? null;
  const { accion } = await registrarSuscripcionPush(prisma, {
    tecnicoId: session.tecnicoId,
    endpoint,
    p256dh,
    auth,
    userAgent: ua,
  });
  return NextResponse.json({ ok: true, accion });
}

export async function DELETE(request: Request) {
  const session = await requireTecnico();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint requerido." }, { status: 400 });
  }
  const n = await desactivarSuscripcionPush(prisma, {
    tecnicoId: session.tecnicoId,
    endpoint,
  });
  if (n === 0) {
    return NextResponse.json({ error: "Suscripción no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
