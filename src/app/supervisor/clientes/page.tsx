"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Search,
  Users,
  Upload,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

type Cliente = {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string;
  sector: string;
  plan: string;
  activo: boolean;
};

type ImportResult = {
  ok?: boolean;
  mensaje?: string;
  error?: string;
  totalFilas?: number;
  creados?: number;
  actualizados?: number;
  omitidos?: number;
  columnasDetectadas?: string[];
  columnasMapeadas?: string[];
  errores?: { fila: number; motivo: string; cedula?: string }[];
};

export default function ClientesListPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function cargar(query = q) {
    setLoading(true);
    const params = new URLSearchParams({ take: "50" });
    if (query.trim()) params.set("q", query.trim());
    if (incluirInactivos) params.set("incluirInactivos", "1");
    const res = await fetch(`/api/clientes?${params}`);
    const data = await res.json();
    setClientes(data.clientes || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [incluirInactivos]);

  function onPickFile(file: File | null) {
    setImportError("");
    setImportResult(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const n = file.name.toLowerCase();
    if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".ods")) {
      setSelectedFile(null);
      setImportError(
        "Ese archivo es Excel. En Wispro exporte de nuevo eligiendo CSV (no Excel) y luego selecciónelo aquí."
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function ejecutarImportacion() {
    if (!selectedFile) {
      setImportError("Seleccione primero un archivo CSV de Wispro.");
      return;
    }
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile, selectedFile.name || "clientes.csv");
      const res = await fetch("/api/clientes/import", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as ImportResult;
      if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
      setImportResult(data);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await cargar();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Clientes" subtitle="CRM — gestión independiente de tickets" />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/supervisor" className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Panel supervisor
          </Link>
          <Link
            href="/supervisor/clientes/nuevo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo cliente
          </Link>
        </div>

        {/* Panel importación Wispro */}
        <section className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
          <h2 className="font-semibold text-emerald-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar clientes desde Wispro (CSV)
          </h2>
          <ol className="text-xs text-slate-600 list-decimal pl-4 space-y-1">
            <li>En Wispro: Clientes → Exportar → elija <strong>CSV</strong> (no Excel).</li>
            <li>Descargue el correo con el archivo y selecciónelo aquí.</li>
            <li>
              Columnas usadas: Documento/Cédula, Nombre, Teléfono o Celular, Dirección, Barrio o
              Zona.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2 items-center">
            <a
              href="/plantillas/clientes-wispro.csv"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-slate-50"
            >
              <FileDown className="w-4 h-4" /> Plantilla de ejemplo
            </a>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-600 text-emerald-800 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Elegir archivo CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => void ejecutarImportacion()}
              disabled={importing || !selectedFile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Subir e importar
            </button>
          </div>
          {selectedFile && (
            <p className="text-sm text-slate-700">
              Archivo: <span className="font-mono font-medium">{selectedFile.name}</span>{" "}
              <span className="text-slate-400">({Math.round(selectedFile.size / 1024)} KB)</span>
            </p>
          )}
        </section>

        {(importResult || importError) && (
          <div
            className={`rounded-xl border p-4 text-sm space-y-2 ${
              importError ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"
            }`}
          >
            {importError && <p className="font-medium">{importError}</p>}
            {importResult && (
              <>
                <p className="font-medium">{importResult.mensaje}</p>
                <p className="text-xs opacity-90">
                  Filas: {importResult.totalFilas} · Creados: {importResult.creados} ·
                  Actualizados: {importResult.actualizados} · Omitidos: {importResult.omitidos}
                </p>
                {importResult.columnasDetectadas && importResult.columnasDetectadas.length > 0 && (
                  <p className="text-[11px] text-slate-600 break-all">
                    Columnas: {importResult.columnasDetectadas.join(", ")}
                  </p>
                )}
                {importResult.errores && importResult.errores.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-white/70 border p-2 mt-2">
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      Errores ({importResult.errores.length})
                    </p>
                    <ul className="text-xs space-y-1 text-slate-700">
                      {importResult.errores.slice(0, 80).map((e, i) => (
                        <li key={`${e.fila}-${i}`}>
                          Fila {e.fila}
                          {e.cedula ? ` (${e.cedula})` : ""}: {e.motivo}
                        </li>
                      ))}
                      {importResult.errores.length > 80 && (
                        <li>… y {importResult.errores.length - 80} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            cargar();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cédula, nombre, teléfono..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm">
            Buscar
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
          />
          Incluir clientes inactivos
        </label>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No hay clientes que coincidan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/supervisor/clientes/${c.id}`}
                className="block bg-white rounded-xl border p-4 hover:border-infinity-400 transition"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {c.cedula} · {c.telefono}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.sector} — {c.plan}
                    </p>
                  </div>
                  {!c.activo && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 h-fit">
                      Inactivo
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
