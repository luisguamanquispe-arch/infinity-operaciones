import { NextResponse } from "next/server";
import {
  aplicarReconciliacionE1,
  auditarIntegridadE1,
} from "@/lib/tecnico-identidad-e1";
import { requireSetupToken } from "@/lib/setup-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fase 1 (E1) — auditoría / reconciliación de identidad Tecnico.
 *
 * GET  → solo lectura (auditoría + planRemap)
 * POST → dry-run por defecto; APPLY solo con ?apply=1&confirm=APPLY_E1
 *
 * Auth: SETUP_TOKEN (header x-setup-token o ?token=)
 */
export async function GET(request: Request) {
  const auth = requireSetupToken(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
        receivedLength: auth.receivedLength,
        configuredLength: auth.configuredLength,
      },
      { status: auth.status }
    );
  }

  try {
    const auditoria = await auditarIntegridadE1();
    return NextResponse.json({
      ok: true,
      fase: "F1_E1",
      modo: "AUDIT_READONLY",
      auditoria,
      siguiente:
        "Revisar planRemap y mismatchSesionVsAsignacion. Para dry-run de APPLY: POST sin apply. Para APPLY real: POST ?apply=1&confirm=APPLY_E1",
    });
  } catch (err) {
    console.error("[Setup reconciliar-e1 GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error auditoría E1" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = requireSetupToken(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
        receivedLength: auth.receivedLength,
        configuredLength: auth.configuredLength,
      },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const apply = url.searchParams.get("apply") === "1";
  const confirm = url.searchParams.get("confirm") ?? "";
  const createMissing = url.searchParams.get("createMissing") === "1";

  const body = (await request.json().catch(() => ({}))) as {
    apply?: boolean;
    confirm?: string;
    createMissing?: boolean;
  };

  const doApply = apply || body.apply === true;
  const confirmOk =
    confirm === "APPLY_E1" || body.confirm === "APPLY_E1";
  const doCreateMissing =
    createMissing || body.createMissing === true;

  if (doApply && !confirmOk) {
    return NextResponse.json(
      {
        error:
          "APPLY rechazado: falta confirm=APPLY_E1 (query o JSON body). Ejecute primero GET o POST sin apply.",
      },
      { status: 400 }
    );
  }

  const dryRun = !doApply;

  try {
    const result = await aplicarReconciliacionE1({
      dryRun,
      createMissing: doCreateMissing && !dryRun,
    });

    return NextResponse.json({
      ok: true,
      fase: "F1_E1",
      modo: dryRun ? "DRY_RUN" : "APPLY",
      ...result,
      aviso: dryRun
        ? "Ningún UPDATE aplicado. Para APPLY: POST ?apply=1&confirm=APPLY_E1 (y createMissing=1 si desea crear perfiles faltantes)."
        : "Remaps aplicados. Verificar login técnicos + Mis órdenes. Conservar remap-log vía respuesta JSON.",
    });
  } catch (err) {
    console.error("[Setup reconciliar-e1 POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error reconciliación E1" },
      { status: 500 }
    );
  }
}
