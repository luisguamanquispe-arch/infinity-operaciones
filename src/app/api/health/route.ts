import { NextResponse } from "next/server";
import { gitShaIsStale, gitShaPrefix, LATEST_GIT_SHA_PREFIX } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  const gitSha = process.env.GIT_SHA || "unknown";
  const prefix = gitShaPrefix(gitSha);
  const setupToken = process.env.SETUP_TOKEN?.trim() ?? "";

  let tecnicosActivos: number | null = null;
  let db: {
    ok: boolean;
    enumLeido: boolean | null;
    estadosTicket: string[] | null;
    migrationLeido: boolean | null;
    error?: string;
  } = {
    ok: false,
    enumLeido: null,
    estadosTicket: null,
    migrationLeido: null,
  };

  if (process.env.DATABASE_URL) {
    try {
      tecnicosActivos = await prisma.tecnico.count({
        where: { usuario: { activo: true } },
      });

      const enums = await prisma.$queryRawUnsafe<{ label: string }[]>(`
        SELECT e.enumlabel AS label
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'EstadoTicket'
        ORDER BY e.enumsortorder
      `);
      const labels = (enums || []).map((r) => r.label);
      const enumLeido = labels.includes("LEIDO");

      let migrationLeido: boolean | null = null;
      try {
        const mig = await prisma.$queryRawUnsafe<{ ok: number }[]>(`
          SELECT 1 AS ok FROM "_prisma_migrations"
          WHERE migration_name = '20250728120000_ticket_estado_leido'
          LIMIT 1
        `);
        migrationLeido = Array.isArray(mig) && mig.length > 0;
      } catch {
        migrationLeido = null;
      }

      db = {
        ok: true,
        enumLeido,
        estadosTicket: labels,
        migrationLeido,
      };
    } catch (err) {
      tecnicosActivos = null;
      db = {
        ok: false,
        enumLeido: null,
        estadosTicket: null,
        migrationLeido: null,
        error: err instanceof Error ? err.message : "db_error",
      };
    }
  }

  return NextResponse.json(
    {
      ok: true,
      service: "infinity-operaciones",
      gitSha,
      gitShaShort: prefix || null,
      stale: gitShaIsStale(gitSha),
      latestRecommended: LATEST_GIT_SHA_PREFIX,
      /** true si SETUP_TOKEN está definido (no revela el valor). */
      setupTokenConfigured: setupToken.length > 0,
      setupTokenLength: setupToken.length > 0 ? setupToken.length : 0,
      tecnicosActivos,
      db,
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
