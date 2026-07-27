import { NextResponse } from "next/server";
import { gzipSync } from "zlib";
import { buildBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Backup programado (cron externo).
 * Auth: Authorization: Bearer <BACKUP_CRON_SECRET>
 * Ruta pública en middleware; la seguridad es el secret.
 */
export async function POST(request: Request) {
  const secret = process.env.BACKUP_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "BACKUP_CRON_SECRET no configurado en el servidor" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const includeMedia = new URL(request.url).searchParams.get("media") !== "0";

  try {
    const payload = await buildBackup({ includeMedia });
    const json = JSON.stringify(payload);
    const gz = gzipSync(Buffer.from(json, "utf8"));
    const totalRows = Object.values(payload.counts).reduce((a, b) => a + b, 0);

    console.log(
      `[backup/cron] ok rows=${totalRows} bytes=${gz.length} media=${includeMedia} at=${payload.exportedAt}`
    );

    if (new URL(request.url).searchParams.get("download") === "1") {
      return new NextResponse(new Uint8Array(gz), {
        status: 200,
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="infinity-ops-cron.json.gz"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      exportedAt: payload.exportedAt,
      totalRows,
      bytesGzip: gz.length,
      counts: payload.counts,
      includeMedia,
      hint: "Añada ?download=1 para recibir el .json.gz",
    });
  } catch (err) {
    console.error("[backup/cron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error en backup cron" },
      { status: 500 }
    );
  }
}
