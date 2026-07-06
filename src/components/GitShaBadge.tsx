"use client";

import { useEffect, useState } from "react";

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

  return (
    <p className="text-center text-xs text-slate-400 pt-2">
      Versión servidor: <span className="font-mono">{sha}</span>
      {sha !== "700c46f" && (
        <span className="block text-amber-700 mt-1">
          Hay una versión más reciente — en Render: Manual Deploy → Clear cache
        </span>
      )}
    </p>
  );
}
