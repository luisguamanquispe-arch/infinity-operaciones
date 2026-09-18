"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";
import { ESTADOS_SOLICITUD_LABELS } from "@/lib/inventario-campo/reglas";

type Req = {
  id: string;
  requestNumber: string;
  status: string;
  ticket: { codigo: string; cliente: { nombre: string } };
  tecnico: { usuario: { nombre: string } };
  createdAt: string;
};

export default function SolicitudesListPage() {
  const [items, setItems] = useState<Req[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/material-requests")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setItems(j.items || []);
      });
  }, []);

  return (
    <div>
      <AppHeader title="Solicitudes" subtitle="Materiales de campo" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Solicitudes de materiales</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="border rounded-xl p-3 bg-white">
              <Link href={`/supervisor/inventario/solicitudes/${r.id}`} className="font-medium text-infinity-700">
                {r.requestNumber}
              </Link>
              <p className="text-sm">
                {r.ticket.codigo} · {r.ticket.cliente.nombre} · {r.tecnico.usuario.nombre}
              </p>
              <p className="text-xs text-slate-500">
                {ESTADOS_SOLICITUD_LABELS[r.status] || r.status} ·{" "}
                {new Date(r.createdAt).toLocaleString("es-EC")}
              </p>
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-slate-500">Sin solicitudes.</li>}
        </ul>
      </main>
    </div>
  );
}
