import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import {
  clasificarCalidad,
  parseVelocidadMbpsFromPlan,
  serializeSpeedResult,
} from "@/lib/cliente-app/speedtest";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const rows = await prisma.appClienteSpeedTest.findMany({
      where: { clienteId: session.clienteId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({
      results: rows.map(serializeSpeedResult),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/speedtest/results GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const body = await request.json();

    const downloadMbps = Number(body.downloadMbps);
    const uploadMbps = Number(body.uploadMbps);
    const pingMs = body.pingMs == null ? null : Number(body.pingMs);
    const plataforma =
      typeof body.plataforma === "string" ? body.plataforma.slice(0, 40) : null;

    if (!Number.isFinite(downloadMbps) || downloadMbps < 0 || downloadMbps > 10000) {
      return NextResponse.json({ error: "downloadMbps inválido" }, { status: 400 });
    }
    if (!Number.isFinite(uploadMbps) || uploadMbps < 0 || uploadMbps > 10000) {
      return NextResponse.json({ error: "uploadMbps inválido" }, { status: 400 });
    }
    if (pingMs != null && (!Number.isFinite(pingMs) || pingMs < 0 || pingMs > 60000)) {
      return NextResponse.json({ error: "pingMs inválido" }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: session.clienteId },
      select: { plan: true },
    });
    const planMbps =
      typeof body.planMbps === "number" && Number.isFinite(body.planMbps)
        ? Math.round(body.planMbps)
        : parseVelocidadMbpsFromPlan(cliente?.plan ?? "");

    const calidad = clasificarCalidad(downloadMbps, planMbps);

    const row = await prisma.appClienteSpeedTest.create({
      data: {
        clienteId: session.clienteId,
        pingMs,
        downloadMbps: Math.round(downloadMbps * 100) / 100,
        uploadMbps: Math.round(uploadMbps * 100) / 100,
        planMbps,
        calidad,
        plataforma,
      },
    });

    return NextResponse.json({ ok: true, result: serializeSpeedResult(row) }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/speedtest/results POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
