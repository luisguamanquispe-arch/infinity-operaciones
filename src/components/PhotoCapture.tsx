"use client";

import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { FOTO_LABELS } from "@/lib/utils";

interface PhotoCaptureProps {
  ticketId: string;
  tipo: string;
  existing?: { url: string; imagenSrc?: string } | null;
  onUploaded: () => void;
}

export function PhotoCapture({ ticketId, tipo, existing, onUploaded }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const image = reader.result as string;

      let lat = -1.2491;
      let lng = -78.6168;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve()
          );
        });
      }

      const formData = new FormData();
      formData.append("tipo", tipo);
      formData.append("image", image);
      formData.append("lat", String(lat));
      formData.append("lng", String(lng));

      await fetch(`/api/tickets/${ticketId}/fotos`, {
        method: "POST",
        body: formData,
      });

      setLoading(false);
      onUploaded();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-2">
        {existing ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <Camera className="w-4 h-4 text-slate-400" />
        )}
        <span className="text-sm">{FOTO_LABELS[tipo] || tipo}</span>
      </div>

      {existing ? (
        <a
          href={existing.imagenSrc || existing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-infinity-600 font-medium"
        >
          Ver foto
        </a>
      ) : (
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
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-infinity-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "..." : "Capturar"}
          </button>
        </>
      )}
    </div>
  );
}
