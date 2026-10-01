"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

type Periodo = {
  csat: number | null;
  promedio: number | null;
  tasaRespuesta: number | null;
  solucion: number | null;
  respondidas: number;
  enviadas: number;
};

export default function SatisfaccionMensualPage() {
  const [data, setData] = useState<{
    columnas: string[];
    periodos: { anterior: Periodo; actual: Periodo; mismoMesAnterior: Periodo };
  } | null>(null);

  useEffect(() => {
    fetch("/api/satisfaccion/monthly")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const filas = data
    ? [
        ["CSAT", pct(data.periodos.anterior.csat), pct(data.periodos.actual.csat), pct(data.periodos.mismoMesAnterior.csat)],
        ["Promedio", num(data.periodos.anterior.promedio), num(data.periodos.actual.promedio), num(data.periodos.mismoMesAnterior.promedio)],
        ["Respuesta", pct(data.periodos.anterior.tasaRespuesta), pct(data.periodos.actual.tasaRespuesta), pct(data.periodos.mismoMesAnterior.tasaRespuesta)],
        ["Solución", pct(data.periodos.anterior.solucion), pct(data.periodos.actual.solucion), pct(data.periodos.mismoMesAnterior.solucion)],
      ]
    : [];

  return (
    <>
      <AppHeader title="Satisfacción mensual" />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/supervisor/satisfaccion" className="text-sm text-infinity-700">
          Volver al dashboard
        </Link>
        <p className="mt-3 text-sm text-slate-600">
          Compara el mes anterior, el mes actual y el mismo mes del año pasado.
        </p>
        {data && (
          <table className="mt-4 w-full rounded-xl border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Indicador</th>
                <th className="px-3 py-2">{data.columnas[0]}</th>
                <th className="px-3 py-2">{data.columnas[1]}</th>
                <th className="px-3 py-2">{data.columnas[2]}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila[0]} className="border-b border-slate-100">
                  {fila.map((celda, indice) => (
                    <td key={`${fila[0]}-${indice}`} className="px-3 py-2">
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}

function pct(valor: number | null) {
  return valor == null ? "s/d" : `${valor}%`;
}

function num(valor: number | null) {
  return valor == null ? "s/d" : String(valor);
}
