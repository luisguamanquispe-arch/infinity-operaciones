"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

export default function CombustibleParquePage() {
  const [items, setItems] = useState<
    { id: string; placa: string; cargasCombustible: { fecha: string; total: number; galones: number; consumoFueraPromedio: boolean; estacion: string }[] }[]
  >([]);

  useEffect(() => {
    fetch("/api/vehiculos")
      .then((r) => r.json())
      .then(async (j) => {
        const list = j.items || [];
        const detailed = await Promise.all(
          list.map(async (v: { id: string; placa: string }) => {
            const d = await fetch(`/api/vehiculos/${v.id}`).then((r) => r.json());
            return { id: v.id, placa: v.placa, cargasCombustible: d.cargasCombustible || [] };
          })
        );
        setItems(detailed);
      });
  }, []);

  return (
    <div>
      <AppHeader title="Combustible" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Combustible</h1>
        <ParqueSubnav />
        {items.map((v) => (
          <section key={v.id} className="mb-4">
            <h2 className="font-medium">
              <Link href={`/supervisor/parque-automotor/vehiculos/${v.id}`}>{v.placa}</Link>
            </h2>
            <ul className="text-sm">
              {(v.cargasCombustible || []).map((c) => (
                <li key={c.fecha + c.estacion}>
                  {c.estacion} · {c.galones} gal · ${c.total}
                  {c.consumoFueraPromedio ? " · Consumo fuera del promedio." : ""}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
