"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

export default function AsignacionesParquePage() {
  const [items, setItems] = useState<
    {
      id: string;
      fechaInicio: string;
      fechaFin: string | null;
      vehiculo: { placa: string };
      tecnicoNombre: string;
    }[]
  >([]);

  useEffect(() => {
    fetch("/api/parque/asignaciones")
      .then((r) => r.json())
      .then((j) => setItems(j.items || []));
  }, []);

  return (
    <div>
      <AppHeader title="Asignaciones" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Asignaciones</h1>
        <ParqueSubnav />
        <table className="w-full text-sm bg-white border rounded-xl">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Placa</th>
              <th>Técnico</th>
              <th>Inicio</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.vehiculo.placa}</td>
                <td>{a.tecnicoNombre}</td>
                <td>{new Date(a.fechaInicio).toLocaleString("es-EC")}</td>
                <td>{a.fechaFin ? new Date(a.fechaFin).toLocaleString("es-EC") : "abierta"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
