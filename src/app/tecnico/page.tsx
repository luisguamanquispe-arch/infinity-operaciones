"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  User,
  MapPin,
  ClipboardList,
  Clock,
  Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { WorkMap } from "@/components/WorkMap";
import { TicketList } from "@/components/TicketList";
import { formatDate } from "@/lib/utils";

interface Resumen {
  fecha: string;
  tecnico: string;
  ubicacion: { lat: number; lng: number } | null;
  asignadas: number;
  pendientes: number;
  enProceso: number;
  finalizadas: number;
  tiempoPromedioMin: number;
}

export default function TecnicoDashboard() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [tickets, setTickets] = useState<Parameters<typeof TicketList>[0]["tickets"]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/tecnico/dashboard?filtro=${filtro}`);
    const data = await res.json();
    setResumen(data.resumen);
    setTickets(data.tickets);
    setLoading(false);
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch("/api/tecnico/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Infinity Operaciones" subtitle="Panel del Técnico" />

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Resumen del día */}
        <section className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{resumen && formatDate(resumen.fecha)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-infinity-600" />
            <span className="font-medium">Técnico: {resumen?.tecnico}</span>
          </div>
          {resumen?.ubicacion && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="w-4 h-4" />
              <span>
                GPS: {resumen.ubicacion.lat.toFixed(4)}, {resumen.ubicacion.lng.toFixed(4)}
              </span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Asignadas"
            value={resumen?.asignadas ?? 0}
            icon={ClipboardList}
            color="blue"
          />
          <StatCard label="Pendientes" value={resumen?.pendientes ?? 0} color="yellow" />
          <StatCard label="En proceso" value={resumen?.enProceso ?? 0} color="blue" />
          <StatCard label="Finalizadas" value={resumen?.finalizadas ?? 0} color="green" />
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600 bg-white rounded-xl border p-3">
          <Clock className="w-4 h-4" />
          <span>
            Tiempo promedio de reparación:{" "}
            <strong>{resumen?.tiempoPromedioMin ?? 0} min</strong>
          </span>
        </div>

        {/* Mapa */}
        <section>
          <h2 className="font-semibold mb-3">Mapa de trabajos</h2>
          <WorkMap
            tecnicoLocation={resumen?.ubicacion}
            clientes={tickets
              .filter((t) => t.estado !== "CERRADO")
              .map((t) => ({
                lat: (t.cliente as { lat?: number | null }).lat ?? null,
                lng: (t.cliente as { lng?: number | null }).lng ?? null,
                nombre: t.cliente.nombre,
                codigo: t.codigo,
              }))}
          />
        </section>

        {/* Órdenes */}
        <section>
          <h2 className="font-semibold mb-3">Mis órdenes de trabajo</h2>
          <TicketList tickets={tickets} filtro={filtro} onFiltroChange={setFiltro} />
        </section>
      </main>
    </div>
  );
}
