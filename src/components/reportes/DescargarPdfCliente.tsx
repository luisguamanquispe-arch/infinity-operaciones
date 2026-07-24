"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

type Variant = "header" | "link" | "icon";

interface DescargarPdfClienteProps {
  ticketId: string;
  codigo?: string;
  variant?: Variant;
  className?: string;
}

async function fetchPdfCliente(ticketId: string, codigo?: string) {
  const res = await fetch(`/api/tickets/${ticketId}/reporte-pdf`);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "No se pudo generar el PDF");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = codigo
    ? `reporte-${codigo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`
    : "reporte-soporte.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

export function DescargarPdfCliente({
  ticketId,
  codigo,
  variant = "header",
  className = "",
}: DescargarPdfClienteProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError("");
    try {
      await fetchPdfCliente(ticketId, codigo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar PDF");
    } finally {
      setLoading(false);
    }
  }

  const base =
    variant === "header"
      ? "flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium disabled:opacity-50"
      : variant === "link"
        ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50 whitespace-nowrap"
        : "inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50";

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <button type="button" onClick={onClick} disabled={loading} className={base} title="PDF para cliente">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4" />
        )}
        {variant !== "icon" && (loading ? "Generando…" : "PDF cliente")}
      </button>
      {error && <span className="text-[10px] text-red-600 mt-0.5 max-w-[10rem]">{error}</span>}
    </span>
  );
}
