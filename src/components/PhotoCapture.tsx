"use client";

import { useRef, useState } from "react";
import { Camera, Check, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { FOTO_LABELS } from "@/lib/utils";
import { compressImageFile, fetchWithRetry } from "@/lib/compress-image";

interface PhotoCaptureProps {
  ticketId: string;
  tipo: string;
  existing?: { id?: string; url: string; imagenSrc?: string } | null;
  onUploaded: () => void;
  readOnly?: boolean;
}

export function PhotoCapture({
  ticketId,
  tipo,
  existing,
  onUploaded,
  readOnly = false,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const image = await compressImageFile(file);

      let lat: number | null = null;
      let lng: number | null = null;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 8000, maximumAge: 60000 }
          );
        });
      }

      const res = await fetchWithRetry(`/api/tickets/${ticketId}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, image, lat, lng }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data.error ||
          (res.status === 503
            ? "Servidor ocupado. Espere unos segundos e intente de nuevo."
            : `Error al subir (${res.status})`);
        setError(msg);
        return;
      }

      onUploaded();
    } catch {
      setError("No se pudo procesar la foto. Verifique conexión e intente otra vez.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function eliminar() {
    if (!existing?.id) {
      setError("No se puede eliminar: falta el id de la foto. Actualice la pantalla.");
      return;
    }
    if (!confirm("¿Eliminar esta foto? Podrá capturar otra.")) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/fotos/${existing.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `No se pudo eliminar (${res.status})`);
        return;
      }
      onUploaded();
    } catch {
      setError("Error de conexión al eliminar la foto.");
    } finally {
      setDeleting(false);
    }
  }

  const busy = loading || deleting;

  return (
    <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {existing ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Camera className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm truncate">{FOTO_LABELS[tipo] || tipo}</span>
        </div>

        {!existing && readOnly ? (
          <span className="text-xs text-slate-400 shrink-0">Pendiente</span>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {existing && (
              <a
                href={existing.imagenSrc || existing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-infinity-600 font-medium px-1.5 py-1"
              >
                Ver
              </a>
            )}

            {!readOnly && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-infinity-600 text-white rounded-lg disabled:opacity-50"
                >
                  {loading ? (
                    "Subiendo…"
                  ) : existing ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Cambiar
                    </>
                  ) : (
                    "Capturar"
                  )}
                </button>
                {existing?.id && (
                  <button
                    type="button"
                    onClick={() => void eliminar()}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-red-200 text-red-700 bg-white rounded-lg disabled:opacity-50"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting ? "…" : "Eliminar"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-start gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}
