import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { decodeCsvBuffer, importClientesFromCsv } from "@/lib/clientes-import-wispro";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

function isUploadBlob(value: FormDataEntryValue | null): value is Blob {
  return !!value && typeof value === "object" && typeof (value as Blob).arrayBuffer === "function";
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo leer el archivo (cuerpo demasiado grande o no es multipart). Use un CSV de máximo 15 MB.",
        },
        { status: 400 }
      );
    }

    const raw = form.get("file") ?? form.get("csv") ?? form.get("archivo");
    if (!isUploadBlob(raw)) {
      return NextResponse.json(
        { error: "Falta el archivo. Envíe el campo file con un CSV de Wispro." },
        { status: 400 }
      );
    }

    const fileName =
      "name" in raw && typeof (raw as File).name === "string"
        ? (raw as File).name
        : "clientes.csv";
    const nameLower = fileName.toLowerCase();

    if (
      nameLower.endsWith(".xlsx") ||
      nameLower.endsWith(".xls") ||
      nameLower.endsWith(".ods")
    ) {
      return NextResponse.json(
        {
          error:
            "No se admite Excel. En Wispro: Clientes → Exportar → elija CSV (no Excel) y suba ese archivo.",
        },
        { status: 400 }
      );
    }

    if (
      nameLower &&
      !nameLower.endsWith(".csv") &&
      !nameLower.endsWith(".txt") &&
      !nameLower.endsWith(".tsv")
    ) {
      // Algunos navegadores mandan nombre vacío o sin extensión; se intenta parsear igual
      console.warn("[clientes/import] extensión inusual:", fileName);
    }

    if (raw.size > MAX_BYTES) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx. 15 MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await raw.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    const text = decodeCsvBuffer(buf);
    const result = await importClientesFromCsv(text, session.id);

    return NextResponse.json({
      ok: true,
      archivo: fileName,
      ...result,
      mensaje: `Importación lista: ${result.creados} creados, ${result.actualizados} actualizados, ${result.omitidos} omitidos/con error.`,
    });
  } catch (err) {
    console.error("[clientes/import]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al importar" },
      { status: 500 }
    );
  }
}
