"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

export default function InspeccionesParquePage() {
  const [items, setItems] = useState<{ id: string; placa: string; inspecciones: { id: string; resultado: string; fecha: string }[] }[]>([]);
  useEffect(() => {
    fetch("/api/vehiculos")
      .then((r) => r.json())
      .then(async (j) => {
        const list = j.items || [];
        setItems(
          await Promise.all(
            list.map(async (v: { id: string; placa: string }) => {
              const d = await fetch(`/api/vehiculos/${v.id}`).then((r) => r.json());
              return { id: v.id, placa: v.placa, inspecciones: d.inspecciones || [] };
            })
          )
        );
      });
  }, []);
  return (
    <div>
      <AppHeader title="Inspecciones" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Inspecciones</h1>
        <ParqueSubnav />
        {items.map((v) => (
          <section key={v.id} className="mb-3">
            <Link className="font-medium" href={`/supervisor/parque-automotor/vehiculos/${v.id}`}>
              {v.placa}
            </Link>
            <ul className="text-sm">
              {v.inspecciones.map((i) => (
                <li key={i.id}>
                  {new Date(i.fecha).toLocaleString("es-EC")} · {i.resultado}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
