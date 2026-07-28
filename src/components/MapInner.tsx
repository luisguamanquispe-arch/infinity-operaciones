"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id?: string;
  lat: number;
  lng: number;
  label: string;
  type: "tecnico" | "cliente";
  stale?: boolean;
}

const tecnicoIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const tecnicoStaleIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const clienteIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function MapInner({ points }: { points: MapPoint[] }) {
  const center = points[0] ?? { lat: -1.2491, lng: -78.6168 };
  const route = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {route.length > 1 && (
        <Polyline positions={route} color="#2563eb" weight={3} dashArray="8 8" />
      )}
      {points.map((p, i) => (
        <Marker
          key={p.id || `${p.type}-${p.lat}-${p.lng}-${i}`}
          position={[p.lat, p.lng]}
          icon={
            p.type === "tecnico"
              ? p.stale
                ? tecnicoStaleIcon
                : tecnicoIcon
              : clienteIcon
          }
        >
          <Popup>{p.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
