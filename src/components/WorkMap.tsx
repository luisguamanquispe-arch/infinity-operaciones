"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Navigation } from "lucide-react";
import { googleMapsRouteUrl } from "@/lib/utils";

const MapInner = dynamic(() => import("./MapInner"), { ssr: false, loading: () => (
  <div className="h-64 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-slate-400">
    Cargando mapa...
  </div>
)});

interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  type: "tecnico" | "cliente";
}

interface WorkMapProps {
  tecnicoLocation?: { lat: number; lng: number } | null;
  clientes: { lat: number | null; lng: number | null; nombre: string; codigo?: string }[];
}

export function WorkMap({ tecnicoLocation, clientes }: WorkMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);

  useEffect(() => {
    const pts: MapPoint[] = [];
    if (tecnicoLocation) {
      pts.push({ ...tecnicoLocation, label: "Mi ubicación", type: "tecnico" });
    }
    clientes.forEach((c) => {
      if (c.lat && c.lng) {
        pts.push({
          lat: c.lat,
          lng: c.lng,
          label: c.codigo ? `${c.codigo} - ${c.nombre}` : c.nombre,
          type: "cliente",
        });
      }
    });
    setPoints(pts);
  }, [tecnicoLocation, clientes]);

  const destinos = clientes
    .filter((c) => c.lat && c.lng)
    .map((c) => ({ lat: c.lat!, lng: c.lng! }));

  const mapsUrl =
    tecnicoLocation && destinos.length > 0
      ? googleMapsRouteUrl(tecnicoLocation, destinos)
      : destinos.length > 0
        ? `https://www.google.com/maps/dir/?api=1&destination=${destinos[0].lat},${destinos[0].lng}`
        : null;

  if (points.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-4 text-center text-slate-500 text-sm">
        Sin coordenadas GPS disponibles
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="h-64">
        <MapInner points={points} />
      </div>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 bg-infinity-600 text-white font-medium hover:bg-infinity-700 transition"
        >
          <Navigation className="w-4 h-4" />
          Navegar con Google Maps
        </a>
      )}
    </div>
  );
}
