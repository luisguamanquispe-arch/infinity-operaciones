import { requireClienteSession } from "@/lib/cliente-app/auth";
import { buildPayload, clampDownloadBytes } from "@/lib/cliente-app/speedtest";

export async function GET(request: Request) {
  try {
    await requireClienteSession(request);
    const url = new URL(request.url);
    const requested = parseInt(url.searchParams.get("bytes") || "", 10);
    const bytes = clampDownloadBytes(Number.isFinite(requested) ? requested : undefined);
    const body = buildPayload(bytes);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Speedtest-Bytes": String(bytes),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/speedtest/download]", err);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
