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

interface BackupPreviewAnalisis {
  formatVersion: number;
  exportedAt: string;
  includeMedia: boolean;
  totalRowsInBackup: number;
  tablasFaltantes: string[];
  faltaConfirmacionVisita: boolean;
  confirmacionesEnBackup: number | null;
  requiereConfirmacionBackupAntiguo: boolean;
  advertenciasPreRestauracion: string[];
}

export default function GerenciaBackupPage() {
  const [meta, setMeta] = useState<BackupMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    analisis: BackupPreviewAnalisis;
    confirmacionesActualesEnBd: number;
  } | null>(null);
  const [ackReemplazoCompleto, setAckReemplazoCompleto] = useState(false);
  const [ackBackupAntiguo, setAckBackupAntiguo] = useState(false);
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

  async function prepararRestauracion() {
    if (!file) {
      setErr("Seleccione un archivo .json o .json.gz");
      return;
    }
    if (confirmPhrase !== "RESTAURAR") {
      setErr("Escriba exactamente RESTAURAR para confirmar");
      return;
    }

    setPreviewLoading(true);
    setErr("");
    setMsg("");
    setRestoreResult(null);
    setPreviewData(null);
    setAckReemplazoCompleto(false);
    setAckBackupAntiguo(false);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("preview", "1");
      const res = await fetch("/api/gerencia/backup/restore?preview=1", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo inspeccionar el backup");
      setPreviewData({
        analisis: data.analisis,
        confirmacionesActualesEnBd: Number(data.confirmacionesActualesEnBd ?? 0),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al inspeccionar el archivo");
    } finally {
      setPreviewLoading(false);
    }
  }

  function cancelarConfirmacion() {
    setPreviewData(null);
    setAckReemplazoCompleto(false);
    setAckBackupAntiguo(false);
  }

  async function ejecutarRestauracionConfirmada() {
    if (!file || !previewData) return;
    if (confirmPhrase !== "RESTAURAR") {
      setErr("Escriba exactamente RESTAURAR para confirmar");
      return;
    }
    if (!ackReemplazoCompleto) {
      setErr(
        "Debe marcar la aceptación explícita de reemplazo completo antes de iniciar la restauración."
      );
      return;
    }
    if (previewData.analisis.requiereConfirmacionBackupAntiguo && !ackBackupAntiguo) {
      setErr(
        "Debe marcar la confirmación explícita de que entiende la eliminación de las confirmaciones de visita actuales."
      );
      return;
    }

    setRestoring(true);
    setErr("");
    setMsg("");
    setRestoreResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("confirmPhrase", confirmPhrase);
      form.append("confirmarReemplazoCompleto", "true");
      if (previewData.analisis.requiereConfirmacionBackupAntiguo) {
        form.append("confirmarBackupAntiguo", "true");
      }
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
      setPreviewData(null);
      setAckReemplazoCompleto(false);
      setAckBackupAntiguo(false);
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
            Operación destructiva de <strong>reemplazo completo</strong> (no combina datos). Solo
            use en recuperación ante desastre o migración a una BD nueva vacía/errónea.
          </p>
          <input
            type="file"
            accept=".json,.gz,application/gzip,application/json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreviewData(null);
              setAckReemplazoCompleto(false);
              setAckBackupAntiguo(false);
            }}
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

          {!previewData ? (
            <button
              type="button"
              onClick={prepararRestauracion}
              disabled={previewLoading || restoring || !file}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Revisar backup antes de restaurar
            </button>
          ) : (
            <div className="rounded-xl border-2 border-red-300 bg-red-50/70 p-4 space-y-3 text-sm">
              <div className="flex items-start gap-2 text-red-900">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-700 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Confirmación obligatoria antes de reemplazar la base de datos
                  </p>
                  <p className="text-xs text-red-900/90">
                    Fecha del backup:{" "}
                    <span className="font-mono">{previewData.analisis.exportedAt || "N/D"}</span> ·
                    Filas en backup:{" "}
                    <span className="font-semibold">{previewData.analisis.totalRowsInBackup}</span>{" "}
                    · Confirmaciones actuales en BD:{" "}
                    <span className="font-semibold">{previewData.confirmacionesActualesEnBd}</span>
                  </p>
                </div>
              </div>

              <ul className="list-disc pl-5 text-xs text-red-950 space-y-1">
                {previewData.analisis.advertenciasPreRestauracion.map((adv) => (
                  <li key={adv}>{adv}</li>
                ))}
              </ul>

              <label className="flex items-start gap-2 rounded-lg border border-red-200 bg-white p-3 text-xs text-red-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackReemplazoCompleto}
                  onChange={(e) => setAckReemplazoCompleto(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span>
                  {previewData.analisis.confirmacionesEnBackup === 0 ? (
                    <>
                      Entiendo que esta operación es un <strong>reemplazo completo</strong> (no
                      combina datos) y que la tabla <code>TicketConfirmacionVisita</code> del backup
                      está vacía (<strong>0 registros</strong>), por lo que las confirmaciones
                      actuales ({previewData.confirmacionesActualesEnBd}) serán eliminadas y
                      reemplazadas por cero registros.
                    </>
                  ) : (
                    <>
                      Entiendo que esta operación es un <strong>reemplazo completo</strong> (no
                      combina datos) y autorizo borrar los datos actuales de la base para
                      reemplazarlos según el contenido de este backup.
                    </>
                  )}
                </span>
              </label>

              {previewData.analisis.requiereConfirmacionBackupAntiguo && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ackBackupAntiguo}
                    onChange={(e) => setAckBackupAntiguo(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span>
                    Entiendo que este backup es antiguo y <strong>no contiene confirmaciones de visita</strong>;
                    autorizo eliminar las confirmaciones actuales ({previewData.confirmacionesActualesEnBd}) y
                    acepto que los enlaces de confirmación vigentes dejarán de funcionar.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelarConfirmacion}
                  disabled={restoring}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium"
                >
                  Cancelar (no modificar datos)
                </button>
                <button
                  type="button"
                  onClick={ejecutarRestauracionConfirmada}
                  disabled={
                    restoring ||
                    !ackReemplazoCompleto ||
                    (previewData.analisis.requiereConfirmacionBackupAntiguo && !ackBackupAntiguo)
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {restoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Confirmar y reemplazar datos ahora
                </button>
              </div>
            </div>
          )}

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
