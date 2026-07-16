"use client";

import { useEffect, useState } from "react";
import { gitShaIsStale, gitShaPrefix, LATEST_GIT_SHA_PREFIX } from "@/lib/app-version";

/** Muestra el build desplegado (útil para confirmar redeploy en Render). */
export function GitShaBadge() {
  const [sha, setSha] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSha(typeof d.gitSha === "string" ? d.gitSha.slice(0, 7) : null))
      .catch(() => setSha(null));
  }, []);

  if (!sha) return null;

  const actualizado = !gitShaIsStale(sha);

  return (
    <p className="text-center text-xs text-slate-400 pt-2">
      Versión servidor: <span className="font-mono">{gitShaPrefix(sha) || sha}</span>
      {!actualizado && (
        <span className="block text-amber-700 mt-1">
          Servidor desactualizado — en Render: Manual Deploy → Clear cache (última: {LATEST_GIT_SHA_PREFIX})
        </span>
      )}
    </p>
  );
}