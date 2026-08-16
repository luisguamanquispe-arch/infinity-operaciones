"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

export default function MantParquePage() {
  const [items, setItems] = useState<{ id: string; placa: string; mantenimientos: { id: string; tipo: string; costo: number; descripcion: string }[] }[]>([]);
  useEffect(() => {
    fetch("/api/vehiculos")
      .then((r) => r.json())
      .then(async (j) => {
        const list = j.items || [];
        setItems(
          await Promise.all(
            list.map(async (v: { id: string; placa: string }) => {
              const d = await fetch(`/api/vehiculos/${v.id}`).then((r) => r.json());
              return { id: v.id, placa: v.placa, mantenimientos: d.mantenimientos || [] };
            })
          )
        );
      });
  }, []);
  return (
    <div>
      <AppHeader title="Mantenimiento" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Mantenimiento</h1>
        <ParqueSubnav />
        {items.map((v) => (
          <section key={v.id} className="mb-3">
            <Link className="font-medium" href={`/supervisor/parque-automotor/vehiculos/${v.id}`}>
              {v.placa}
            </Link>
            <ul className="text-sm">
              {v.mantenimientos.map((m) => (
                <li key={m.id}>
                  {m.tipo} · ${m.costo} · {m.descripcion}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
