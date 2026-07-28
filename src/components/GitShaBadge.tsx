"use client";

import { useEffect, useState } from "react";

/** Muestra el build desplegado (útil para confirmar redeploy en Render). */
export function GitShaBadge() {
  const [sha, setSha] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const short =
          typeof d.gitShaShort === "string"
            ? d.gitShaShort
            : typeof d.gitSha === "string"
              ? d.gitSha.slice(0, 7)
              : null;
        setSha(short);
      })
      .catch(() => setSha(null));
  }, []);

  if (!sha) return null;

  return (
    <p className="text-center text-xs text-slate-400 pt-2">
      Versión servidor: <span className="font-mono">{sha}</span>
      {" · "}
      <a href="/api/health" className="underline hover:text-slate-600" target="_blank" rel="noreferrer">
        /api/health
      </a>
    </p>
  );
}
