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
  errores?: { fila: number; motivo: string; cedula?: string }[];
};

export default function ClientesListPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [importing, setImporting] = useState(false);
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

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/clientes/import", { method: "POST", body: form });
      const data = (await res.json()) as ImportResult;
      if (!res.ok) throw new Error(data.error || "No se pudo importar");
      setImportResult(data);
      await cargar();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
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
          <div className="flex flex-wrap gap-2">
            <a
              href="/plantillas/clientes-wispro.csv"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-white"
            >
              <FileDown className="w-4 h-4" /> Plantilla CSV
            </a>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-600 text-emerald-800 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Importar CSV Wispro
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
            <Link
              href="/supervisor/clientes/nuevo"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nuevo cliente
            </Link>
          </div>
        </div>

        {(importResult || importError) && (
          <div
            className={`rounded-xl border p-4 text-sm space-y-2 ${
              importError ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"
            }`}
          >
            {importError && <p>{importError}</p>}
            {importResult && (
              <>
                <p className="font-medium">{importResult.mensaje}</p>
                <p className="text-xs opacity-90">
                  Filas: {importResult.totalFilas} · Creados: {importResult.creados} ·
                  Actualizados: {importResult.actualizados} · Omitidos: {importResult.omitidos}
                </p>
                {importResult.errores && importResult.errores.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-white/70 border border-emerald-100 p-2 mt-2">
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      Errores ({importResult.errores.length})
                    </p>
                    <ul className="text-xs space-y-1 text-slate-700">
                      {importResult.errores.slice(0, 50).map((e, i) => (
                        <li key={`${e.fila}-${i}`}>
                          Fila {e.fila}
                          {e.cedula ? ` (${e.cedula})` : ""}: {e.motivo}
                        </li>
                      ))}
                      {importResult.errores.length > 50 && (
                        <li>… y {importResult.errores.length - 50} más</li>
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
            <p className="text-xs mt-2">
              Puede importar un CSV de Wispro o{" "}
              <Link href="/supervisor/clientes/nuevo" className="text-infinity-600 underline">
                crear uno manualmente
              </Link>
              .
            </p>
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
