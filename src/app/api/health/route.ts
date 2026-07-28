import { NextResponse } from "next/server";
import { gitShaIsStale, gitShaPrefix, LATEST_GIT_SHA_PREFIX } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  const gitSha = process.env.GIT_SHA || "unknown";
  const prefix = gitShaPrefix(gitSha);
  const setupToken = process.env.SETUP_TOKEN?.trim() ?? "";

  let tecnicosActivos: number | null = null;
  if (process.env.DATABASE_URL) {
    try {
      tecnicosActivos = await prisma.tecnico.count({
        where: { usuario: { activo: true } },
      });
    } catch {
      tecnicosActivos = null;
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
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
