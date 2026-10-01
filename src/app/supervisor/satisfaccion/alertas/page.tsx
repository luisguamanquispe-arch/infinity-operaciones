"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

type Alerta = {
  id: string;
  ratingGeneral: number | null;
  solucionado: string | null;
  comentario: string | null;
  tipoServicio: string;
  answeredAt: string | null;
  cliente: { nombre: string };
  tecnico: { usuario: { nombre: string } } | null;
  ticket: { codigo: string };
  seguimientos: { id: string; status: string }[];
};

export default function AlertasSatisfaccionPage() {
  const [filas, setFilas] = useState<Alerta[]>([]);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState<Record<string, string>>({});

  function cargar() {
    fetch("/api/satisfaccion/alerts")
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las alertas");
        const data = await res.json();
        setFilas(data.filas);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crearSeguimiento(id: string) {
    const res = await fetch(`/api/satisfaccion/${id}/followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivo[id] || "" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo registrar el seguimiento");
      return;
    }
    cargar();
  }

  return (
    <>
      <AppHeader title="Clientes insatisfechos" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/supervisor/satisfaccion" className="text-sm text-infinity-700">
          Volver al dashboard
        </Link>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                {["Cliente", "OT", "Técnico", "Servicio", "Fecha", "Calificación", "Comentario", "Seguimiento"].map(
                  (col) => (
                    <th key={col} className="px-3 py-2 font-medium">
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2">{fila.cliente.nombre}</td>
                  <td className="px-3 py-2">{fila.ticket.codigo}</td>
                  <td className="px-3 py-2">{fila.tecnico?.usuario.nombre || "Sin técnico"}</td>
                  <td className="px-3 py-2">{fila.tipoServicio}</td>
                  <td className="px-3 py-2">{fila.answeredAt ? new Date(fila.answeredAt).toLocaleDateString("es-EC") : ""}</td>
                  <td className="px-3 py-2">
                    {fila.ratingGeneral ?? "s/d"} / {fila.solucionado || "s/d"}
                  </td>
                  <td className="px-3 py-2">{fila.comentario || "—"}</td>
                  <td className="px-3 py-2">
                    <p>{fila.seguimientos[0]?.status || "Sin seguimiento"}</p>
                    <input
                      className="mt-2 w-full rounded border px-2 py-1"
                      placeholder="Motivo"
                      value={motivo[fila.id] || ""}
                      onChange={(event) => setMotivo({ ...motivo, [fila.id]: event.target.value })}
                    />
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-infinity-700"
                      onClick={() => crearSeguimiento(fila.id)}
                    >
                      Registrar seguimiento
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
