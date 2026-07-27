import { NextResponse } from "next/server";
import { gzipSync } from "zlib";
import { getFullSession } from "@/lib/auth";
import { buildBackup, getBackupStatus } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 120;

async function requireAdmin() {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return null;
  }
  return session;
}

/** Metadatos / conteos sin descargar el archivo. */
export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Solo gerencia (ADMIN) puede gestionar backups" }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("meta") === "1") {
    const status = await getBackupStatus();
    return NextResponse.json({
      ok: true,
      ...status,
      restoreConfirmPhrase: "RESTAURAR",
    });
  }

  const includeMedia = url.searchParams.get("media") !== "0";

  try {
    const payload = await buildBackup({ includeMedia });
    const json = JSON.stringify(payload);
    const gz = gzipSync(Buffer.from(json, "utf8"), { level: 6 });
    const stamp = payload.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
    const filename = `infinity-ops-backup-${stamp}${includeMedia ? "" : "-sin-media"}.json.gz`;

    return new NextResponse(new Uint8Array(gz), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Backup-Rows": String(Object.values(payload.counts).reduce((a, b) => a + b, 0)),
        "X-Backup-Include-Media": includeMedia ? "1" : "0",
      },
    });
  } catch (err) {
    console.error("[backup/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el backup" },
      { status: 500 }
    );
  }
}
