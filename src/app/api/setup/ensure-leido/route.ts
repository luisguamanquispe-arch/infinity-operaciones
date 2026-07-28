import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSetupToken } from "@/lib/setup-token";

export const runtime = "nodejs";

/**
 * Fuerza enum LEIDO (SETUP_TOKEN).
 * Útil si el arranque omitió la migración del semáforo.
 */
export async function POST(request: Request) {
  const gate = requireSetupToken(request);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: gate.error,
        receivedLength: gate.receivedLength,
        configuredLength: gate.configuredLength,
      },
      { status: gate.status }
    );
  }

  const before = await prisma
    .$queryRawUnsafe<{ label: string }[]>(`
    SELECT e.enumlabel AS label
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EstadoTicket'
    ORDER BY e.enumsortorder
  `)
    .catch(() => [] as { label: string }[]);

  let added = false;
  const labelsBefore = (before || []).map((r) => r.label);
  if (!labelsBefore.includes("LEIDO")) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "EstadoTicket" ADD VALUE IF NOT EXISTS 'LEIDO'`
      );
      added = true;
    } catch {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TYPE "EstadoTicket" ADD VALUE 'LEIDO';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      added = true;
    }
  }

  const after = await prisma.$queryRawUnsafe<{ label: string }[]>(`
    SELECT e.enumlabel AS label
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EstadoTicket'
    ORDER BY e.enumsortorder
  `);
  const labels = (after || []).map((r) => r.label);

  return NextResponse.json({
    ok: labels.includes("LEIDO"),
    added,
    estadosTicket: labels,
    hint: labels.includes("LEIDO")
      ? "Enum LEIDO listo. Recargue supervisor/técnico (Ctrl+F5)."
      : "No se pudo agregar LEIDO. Revise logs de Render / permisos de BD.",
  });
}
