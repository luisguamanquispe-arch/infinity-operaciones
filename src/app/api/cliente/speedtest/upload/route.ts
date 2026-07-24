import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { SPEEDTEST_MAX_BYTES } from "@/lib/cliente-app/speedtest";

export async function POST(request: Request) {
  try {
    await requireClienteSession(request);
    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.byteLength > SPEEDTEST_MAX_BYTES) {
      return NextResponse.json(
        { error: `Payload máximo ${SPEEDTEST_MAX_BYTES} bytes` },
        { status: 413 }
      );
    }
    return NextResponse.json({
      ok: true,
      bytesReceived: buf.byteLength,
      t: Date.now(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/speedtest/upload]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
