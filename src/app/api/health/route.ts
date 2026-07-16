import { NextResponse } from "next/server";
import { gitShaIsStale, gitShaPrefix, LATEST_GIT_SHA_PREFIX } from "@/lib/app-version";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  const gitSha = process.env.GIT_SHA || "unknown";
  const prefix = gitShaPrefix(gitSha);

  return NextResponse.json(
    {
      ok: true,
      service: "infinity-operaciones",
      gitSha,
      gitShaShort: prefix || null,
      stale: gitShaIsStale(gitSha),
      latestRecommended: LATEST_GIT_SHA_PREFIX,
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
