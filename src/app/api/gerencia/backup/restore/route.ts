import { NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { getFullSession } from "@/lib/auth";
import { RESTORE_CONFIRM_PHRASE, restoreBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Restaura un backup (.json o .json.gz).
 * Body JSON: { confirmPhrase: "RESTAURAR", payload: <objeto backup> }
 * o multipart: file + confirmPhrase
 */
export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo gerencia (ADMIN) puede restaurar" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let confirmPhrase = "";
    let raw: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      confirmPhrase = String(form.get("confirmPhrase") || "").trim();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Falta el archivo de backup" }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      raw = parseBackupBuffer(buf, file.name);
    } else {
      const body = await request.json();
      confirmPhrase = String(body.confirmPhrase || "").trim();
      raw = body.payload ?? body.backup ?? null;
      if (!raw) {
        return NextResponse.json(
          { error: "Envíe payload (objeto backup) o use multipart con file" },
          { status: 400 }
        );
      }
    }

    if (confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
      return NextResponse.json(
        {
          error: `Confirmación inválida. Escriba exactamente: ${RESTORE_CONFIRM_PHRASE}`,
          requiredPhrase: RESTORE_CONFIRM_PHRASE,
        },
        { status: 400 }
      );
    }

    const result = await restoreBackup(raw, { confirmPhrase });

    console.log(
      `[backup/restore] admin=${session.email} inserted=${JSON.stringify(result.inserted)}`
    );

    return NextResponse.json({
      ok: true,
      mensaje: "Restauración completada. Cierre sesión y vuelva a entrar si cambió usuarios.",
      ...result,
    });
  } catch (err) {
    console.error("[backup/restore]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al restaurar" },
      { status: 500 }
    );
  }
}

function parseBackupBuffer(buf: Buffer, filename: string): unknown {
  const isGz =
    filename.toLowerCase().endsWith(".gz") ||
    (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b);
  const text = (isGz ? gunzipSync(buf) : buf).toString("utf8");
  return JSON.parse(text);
}
