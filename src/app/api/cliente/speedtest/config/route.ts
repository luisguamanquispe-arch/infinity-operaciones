import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import {
  SPEEDTEST_CHUNK_BYTES,
  SPEEDTEST_DOWNLOAD_CHUNKS,
  SPEEDTEST_PING_SAMPLES,
  SPEEDTEST_UPLOAD_BYTES,
  SPEEDTEST_UPLOAD_ROUNDS,
  parseVelocidadMbpsFromPlan,
} from "@/lib/cliente-app/speedtest";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const cliente = await prisma.cliente.findUnique({
      where: { id: session.clienteId },
      select: { plan: true },
    });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const planMbps = parseVelocidadMbpsFromPlan(cliente.plan);

    return NextResponse.json({
      config: {
        plan: cliente.plan,
        planMbps,
        chunkBytes: SPEEDTEST_CHUNK_BYTES,
        downloadChunks: SPEEDTEST_DOWNLOAD_CHUNKS,
        uploadBytes: SPEEDTEST_UPLOAD_BYTES,
        uploadRounds: SPEEDTEST_UPLOAD_ROUNDS,
        pingSamples: SPEEDTEST_PING_SAMPLES,
        endpoints: {
          ping: "/api/cliente/speedtest/ping",
          download: "/api/cliente/speedtest/download",
          upload: "/api/cliente/speedtest/upload",
          results: "/api/cliente/speedtest/results",
        },
        aviso:
          "Medición orientativa contra servidores Infinity. No reemplaza un speedtest de laboratorio.",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/speedtest/config]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
