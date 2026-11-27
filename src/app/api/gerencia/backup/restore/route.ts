import { NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { getFullSession } from "@/lib/auth";
import {
  BackupConfirmationRequiredError,
  BackupFullReplaceConfirmationRequiredError,
  RESTORE_CONFIRM_PHRASE,
  analizarCompatibilidadBackup,
  getTableDelegate,
  restoreBackup,
} from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Restaura un backup (.json o .json.gz).
 * Body JSON: { confirmPhrase: "RESTAURAR", payload: <objeto backup>, preview?: boolean, confirmarBackupAntiguo?: boolean }
 * o multipart: file + confirmPhrase (+ preview="1" opcional, confirmarBackupAntiguo="true" opcional)
 */
export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo gerencia (ADMIN) puede restaurar" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    let isPreview = url.searchParams.get("preview") === "1";
    const contentType = request.headers.get("content-type") || "";
    let confirmPhrase = "";
    let confirmarReemplazoCompleto = false;
    let confirmarBackupAntiguo = false;
    let raw: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      confirmPhrase = String(form.get("confirmPhrase") || "").trim();
      if (String(form.get("preview") || "") === "1" || String(form.get("preview") || "") === "true") {
        isPreview = true;
      }
      confirmarReemplazoCompleto =
        String(form.get("confirmarReemplazoCompleto") || "").toLowerCase() === "true";
      confirmarBackupAntiguo =
        String(form.get("confirmarBackupAntiguo") || "").toLowerCase() === "true";
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Falta el archivo de backup" }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      raw = parseBackupBuffer(buf, file.name);
    } else {
      const body = await request.json();
      confirmPhrase = String(body.confirmPhrase || "").trim();
      if (body.preview === true) isPreview = true;
      confirmarReemplazoCompleto = body.confirmarReemplazoCompleto === true;
      confirmarBackupAntiguo = body.confirmarBackupAntiguo === true;
      raw = body.payload ?? body.backup ?? null;
      if (!raw) {
        return NextResponse.json(
          { error: "Envíe payload (objeto backup) o use multipart con file" },
          { status: 400 }
        );
      }
    }

    if (isPreview) {
      const analisis = analizarCompatibilidadBackup(raw);
      const confirmacionesActualesEnBd = await getTableDelegate("TicketConfirmacionVisita").count();
      return NextResponse.json({
        ok: true,
        preview: true,
        analisis,
        confirmacionesActualesEnBd,
      });
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

    const result = await restoreBackup(raw, {
      confirmPhrase,
      confirmarReemplazoCompleto,
      confirmarBackupAntiguoSinConfirmaciones: confirmarBackupAntiguo,
    });

    console.log(
      `[backup/restore] admin=${session.email} inserted=${JSON.stringify(result.inserted)}`
    );

    return NextResponse.json({
      ok: true,
      mensaje: "Restauración completada. Cierre sesión y vuelva a entrar si cambió usuarios.",
      ...result,
    });
  } catch (err) {
    if (err instanceof BackupFullReplaceConfirmationRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          requiresFullReplaceConfirmation: true,
          analisis: err.analisis,
        },
        { status: 409 }
      );
    }
    if (err instanceof BackupConfirmationRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          requiresLegacyConfirmation: true,
          analisis: err.analisis,
        },
        { status: 409 }
      );
    }
    console.error("[backup/restore]", err instanceof Error ? err.message : "Error al restaurar");
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
