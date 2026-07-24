import { NextResponse } from "next/server";
import { gitShaIsStale, gitShaPrefix, LATEST_GIT_SHA_PREFIX } from "@/lib/app-version";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  const gitSha = process.env.GIT_SHA || "unknown";
  const prefix = gitShaPrefix(gitSha);
  const setupToken = process.env.SETUP_TOKEN?.trim() ?? "";

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
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
