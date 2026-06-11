"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

interface FirmaMiniaturaProps {
  src: string | null;
  nombre?: string;
}

function resolveSrc(src: string): string {
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (typeof window !== "undefined" && src.startsWith("/")) {
    return `${window.location.origin}${src}`;
  }
  return src;
}

export function FirmaMiniatura({ src, nombre }: FirmaMiniaturaProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className="w-12 h-12 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center"
        title="Sin firma"
      >
        <PenLine className="w-4 h-4 text-slate-300" />
      </div>
    );
  }

  return (
    <img
      src={resolveSrc(src)}
      alt={nombre ? `Firma de ${nombre}` : "Firma del cliente"}
      title={nombre ? `Firma: ${nombre}` : "Firma del cliente"}
      className="w-12 h-12 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
      onError={() => setError(true)}
    />
  );
}
