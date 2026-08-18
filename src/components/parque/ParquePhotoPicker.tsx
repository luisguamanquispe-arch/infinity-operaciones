"use client";

import { useRef, useState } from "react";
import { compressImageFile } from "@/lib/compress-image";

export type FotoLocal = { key: string; dataUrl: string };

export function ParquePhotoPicker({
  labelCamara = "Tomar foto",
  labelGaleria = "Seleccionar foto",
  help,
  max = 1,
  value,
  onChange,
  disabled,
}: {
  labelCamara?: string;
  labelGaleria?: string;
  help?: string;
  max?: number;
  value: FotoLocal[];
  onChange: (next: FotoLocal[]) => void;
  disabled?: boolean;
}) {
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      const next = [...value];
      for (const file of Array.from(files)) {
        if (next.length >= max) break;
        const dataUrl = await compressImageFile(file);
        next.push({ key: `${Date.now()}-${next.length}`, dataUrl });
      }
      onChange(next);
    } catch {
      setError("No se pudo leer la foto. Intente de nuevo.");
    } finally {
      setBusy(false);
      if (camaraRef.current) camaraRef.current.value = "";
      if (galeriaRef.current) galeriaRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {help && <p className="text-xs text-slate-600">{help}</p>}
      <div className="flex gap-2 flex-wrap">
        <input
          ref={camaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          multiple={max > 1}
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
        <button
          type="button"
          className="flex-1 min-h-11 px-3 py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          disabled={disabled || busy || value.length >= max}
          onClick={() => camaraRef.current?.click()}
        >
          {busy ? "Procesando…" : labelCamara}
        </button>
        <button
          type="button"
          className="flex-1 min-h-11 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50"
          disabled={disabled || busy || value.length >= max}
          onClick={() => galeriaRef.current?.click()}
        >
          {labelGaleria}
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {value.map((f) => (
            <div key={f.key} className="relative">
              <img src={f.dataUrl} alt="" className="w-20 h-20 object-cover rounded border" />
              {!disabled && (
                <button
                  type="button"
                  className="absolute -top-1 -right-1 w-6 h-6 bg-white border rounded-full text-xs"
                  onClick={() => onChange(value.filter((x) => x.key !== f.key))}
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {max > 1 && (
        <p className="text-xs text-slate-500">
          {value.length} de {max} fotos
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
