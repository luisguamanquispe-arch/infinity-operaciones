"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InventarioSubnav } from "@/components/inventario/InventarioSubnav";

type Mov = {
  id: string;
  movementNumber: string;
  movementType: string;
  quantity: number;
  totalCost: number;
  notes: string | null;
  createdAt: string;
  inventario: { nombre: string; unidad: string };
  warehouse: { name: string };
  performedBy: { nombre: string } | null;
};

export default function KardexPage() {
  const [items, setItems] = useState<Mov[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/inventario/movements")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setItems(j.items || []);
      });
  }, []);

  return (
    <div>
      <AppHeader title="Kardex" subtitle="Movimientos de inventario" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-semibold">Kardex</h1>
        <InventarioSubnav />
        {error && <p className="text-red-700 text-sm">{error}</p>}
        <p className="text-xs text-slate-500">Los movimientos históricos no se editan ni eliminan.</p>
        <table className="w-full text-sm bg-white border rounded-xl">
          <thead>
            <tr className="text-left bg-slate-50">
              <th className="p-2">Número</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Material</th>
              <th>Cant.</th>
              <th>Costo</th>
              <th>Notas</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.movementNumber}</td>
                <td>{new Date(m.createdAt).toLocaleString("es-EC")}</td>
                <td>{m.movementType}</td>
                <td>{m.inventario.nombre}</td>
                <td>
                  {m.quantity} {m.inventario.unidad}
                </td>
                <td>${m.totalCost}</td>
                <td className="max-w-[12rem] truncate text-xs text-slate-600" title={m.notes || ""}>
                  {m.notes || "—"}
                </td>
                <td>{m.performedBy?.nombre || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
