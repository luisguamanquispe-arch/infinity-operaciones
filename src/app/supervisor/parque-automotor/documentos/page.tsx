"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

export default function DocsParquePage() {
  const [items, setItems] = useState<
    { id: string; placa: string; documentos: { id: string; tipo: string; numero: string | null }[]; docsAlertas: { tipo: string; alerta: string }[] }[]
  >([]);
  useEffect(() => {
    fetch("/api/vehiculos")
      .then((r) => r.json())
      .then(async (j) => {
        const list = j.items || [];
        setItems(
          await Promise.all(
            list.map(async (v: { id: string; placa: string }) => {
              const d = await fetch(`/api/vehiculos/${v.id}`).then((r) => r.json());
              return {
                id: v.id,
                placa: v.placa,
                documentos: d.documentos || [],
                docsAlertas: d.docsAlertas || [],
              };
            })
          )
        );
      });
  }, []);
  return (
    <div>
      <AppHeader title="Documentos" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Documentos</h1>
        <ParqueSubnav />
        {items.map((v) => (
          <section key={v.id} className="mb-3">
            <Link className="font-medium" href={`/supervisor/parque-automotor/vehiculos/${v.id}`}>
              {v.placa}
            </Link>
            {v.docsAlertas.length > 0 && (
              <p className="text-xs text-amber-800">Alertas: {v.docsAlertas.map((a) => a.tipo).join(", ")}</p>
            )}
            <ul className="text-sm">
              {v.documentos.map((d) => (
                <li key={d.id}>
                  {d.tipo} {d.numero}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
