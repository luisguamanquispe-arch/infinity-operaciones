"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

type Nov = {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string;
  puedeCircular: boolean;
  vehiculo: { id: string; placa: string };
  tecnicoNombre: string;
};

export default function NovedadesVehPage() {
  const [items, setItems] = useState<Nov[]>([]);

  async function cargar() {
    const r = await fetch("/api/parque/novedades");
    const j = await r.json();
    setItems(j.items || []);
  }
  useEffect(() => {
    void cargar();
  }, []);

  async function transicionar(vehiculoId: string, novedadId: string, estado: string) {
    await fetch(`/api/vehiculos/${vehiculoId}/novedades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novedadId, estado }),
    });
    await cargar();
  }

  return (
    <div>
      <AppHeader title="Novedades vehiculares" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Novedades vehiculares</h1>
        <ParqueSubnav />
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="border rounded-xl p-3 bg-white">
              <p className="font-medium">
                {n.vehiculo.placa} · {n.tipo} · {n.estado}
                {!n.puedeCircular && <span className="text-red-700"> · no puede circular</span>}
              </p>
              <p className="text-sm">{n.descripcion}</p>
              <p className="text-xs text-slate-500">{n.tecnicoNombre}</p>
              <div className="flex gap-2 mt-2 text-sm">
                <button className="border rounded px-2" onClick={() => transicionar(n.vehiculo.id, n.id, "EN_REVISION")}>
                  En revisión
                </button>
                <button className="border rounded px-2" onClick={() => transicionar(n.vehiculo.id, n.id, "EN_REPARACION")}>
                  En reparación
                </button>
                <button className="border rounded px-2" onClick={() => transicionar(n.vehiculo.id, n.id, "RESUELTA")}>
                  Resuelta
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
