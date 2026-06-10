"use client";

import { FOTO_LABELS } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { Camera, MapPin } from "lucide-react";

interface Foto {
  id: string;
  tipo: string;
  url: string;
  lat: number | null;
  lng: number | null;
  tomadaEn: string;
}

interface PhotoGalleryProps {
  titulo: string;
  fotos: Foto[];
}

export function PhotoGallery({ titulo, fotos }: PhotoGalleryProps) {
  if (fotos.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <Camera className="w-4 h-4" />
        {titulo}
        <span className="text-xs font-normal text-slate-400">({fotos.length})</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fotos.map((foto) => (
          <a
            key={foto.id}
            href={foto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-slate-100 rounded-xl overflow-hidden border hover:border-infinity-400 transition"
          >
            <div className="aspect-square relative">
              <img
                src={foto.url}
                alt={FOTO_LABELS[foto.tipo] || foto.tipo}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-2 space-y-0.5">
              <p className="text-xs font-medium text-slate-700 truncate">
                {FOTO_LABELS[foto.tipo] || foto.tipo}
              </p>
              <p className="text-[10px] text-slate-400">{formatDateTime(foto.tomadaEn)}</p>
              {foto.lat && foto.lng && (
                <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  {foto.lat.toFixed(4)}, {foto.lng.toFixed(4)}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
