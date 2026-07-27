"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Upload,
  Loader2,
  ShieldAlert,
  Database,
  RefreshCw,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface BackupMeta {
  tables: Record<string, number>;
  totalRows: number;
  estimatedHeavy: boolean;
  restoreConfirmPhrase: string;
}

export default function GerenciaBackupPage() {
  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [restoreResult, setRestoreResult] = useState<{
    inserted: Record<string, number>;
    deleted: Record<string, number>;
    warnings: string[];
  } | null>(null);

  const cargarMeta = useCallback(async () => {
    setLoadingMeta(true);
    setErr("");
    try {
      const res = await fetch("/api/gerencia/backup?meta=1", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el estado");
      setMeta(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setMeta(null);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void cargarMeta();
  }, [cargarMeta]);

  async function descargar() {
    setDownloading(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(
        `/api/gerencia/backup?media=${includeMedia ? "1" : "0"}`
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo generar el backup");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const name = match?.[1] || "infinity-ops-backup.json.gz";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Backup descargado: ${name}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al descargar");
    } finally {
      setDownloading(false);
    }
  }

  async function restaurar() {
    if (!file) {
      setErr("Seleccione un archivo .json o .json.gz");
      return;
    }
    if (confirmPhrase !== "RESTAURAR") {
      setErr('Escriba exactamente RESTAURAR para confirmar');
      return;
    }
    const ok = window.confirm(
      "ADVERTENCIA: Esto BORRARÁ todos los datos actuales de la base y los reemplazará con el backup.\n\n¿Continuar?"
    );
    if (!ok) return;

    setRestoring(true);
    setErr("");
    setMsg("");
    setRestoreResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("confirmPhrase", confirmPhrase);
      const res = await fetch("/api/gerencia/backup/restore", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fallo al restaurar");
      setRestoreResult({
        inserted: data.inserted || {},
        deleted: data.deleted || {},
        warnings: data.warnings || [],
      });
      setMsg(data.mensaje || "Restauración completada");
      setConfirmPhrase("");
      setFile(null);
      await cargarMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Backup y restauración" subtitle="Gerencia — Infinity Operaciones" />

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <Link
          href="/gerencia"
          className="inline-flex items-center gap-1.5 text-sm text-infinity-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a gerencia
        </Link>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
          <div>
            <p className="font-semibold">Respaldo lógico del sistema</p>
            <p className="mt-1 text-amber-900/90">
              Exporta usuarios, clientes, tickets, órdenes, firmas, inventario, Help Desk y app
              Connect. Guarde el archivo fuera de Render (PC, Drive, NAS). La restauración{" "}
              <strong>reemplaza</strong> toda la base actual.
            </p>
          </div>
        </div>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-infinity-600" />
              Estado actual
            </h2>
            <button
              type="button"
              onClick={() => cargarMeta()}
              className="text-xs inline-flex items-center gap-1 text-slate-600 hover:text-infinity-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>
          {loadingMeta ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-infinity-600" />
            </div>
          ) : meta ? (
            <>
              <p className="text-sm text-slate-600">
                Total filas: <span className="font-semibold text-slate-900">{meta.totalRows}</span>
                {meta.estimatedHeavy && (
                  <span className="ml-2 text-amber-700 text-xs">
                    (volumen alto — considere backup sin media embebida)
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs max-h-48 overflow-y-auto">
                {Object.entries(meta.tables)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <div key={k} className="rounded-lg bg-slate-50 border px-2 py-1.5 flex justify-between">
                      <span className="text-slate-600 truncate">{k}</span>
                      <span className="font-mono font-medium">{n}</span>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">No se pudo cargar el estado</p>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-600" />
            Descargar backup
          </h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
              className="rounded"
            />
            Incluir imagenData de fotos y firmas (archivo más pesado)
          </label>
          <button
            type="button"
            onClick={descargar}
            disabled={downloading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Generar y descargar .json.gz
          </button>
        </section>

        <section className="bg-white rounded-xl border border-red-100 p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-red-800">
            <Upload className="w-4 h-4" />
            Restaurar backup
          </h2>
          <p className="text-xs text-red-700/90">
            Operación destructiva. Solo use en recuperación ante desastre o migración a una BD
            nueva vacía/errónea.
          </p>
          <input
            type="file"
            accept=".json,.gz,application/gzip,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <div>
            <label className="text-xs font-medium text-slate-600">
              Escriba RESTAURAR para confirmar
            </label>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="RESTAURAR"
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={restaurar}
            disabled={restoring || !file}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {restoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Restaurar y reemplazar datos
          </button>

          {restoreResult && (
            <div className="rounded-lg bg-slate-50 border p-3 text-xs space-y-2">
              <p className="font-medium">Resumen</p>
              <p>
                Insertados:{" "}
                {Object.values(restoreResult.inserted).reduce((a, b) => a + b, 0)} filas
              </p>
              {restoreResult.warnings.length > 0 && (
                <ul className="text-amber-800 list-disc pl-4">
                  {restoreResult.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {msg && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{msg}</p>}
        {err && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">{err}</p>}
      </main>
    </div>
  );
}
