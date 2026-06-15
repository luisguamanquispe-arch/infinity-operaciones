"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ESTADO_LABELS, PRIORIDAD_LABELS, TIPO_LABELS, formatDateTime } from "@/lib/utils";

export interface OrdenPendiente {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn?: string | null;
  cliente: { nombre: string; sector: string };
}

interface Props {
  ordenes: OrdenPendiente[];
}

const prioridadColor: Record<string, string> = {
  ALTA: "text-red-600 font-semibold",
  MEDIA: "text-amber-600",
  BAJA: "text-slate-500",
};

/** Lista fija de órdenes pendientes del técnico — sin filtros ni estados mezclados. */
export function TecnicoOrdenesPendientes({ ordenes }: Props) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 font-medium">Ticket</th>
              <th className="text-left p-3 font-medium">Programado</th>
              <th className="text-left p-3 font-medium">Cliente</th>
              <th className="text-left p-3 font-medium hidden sm:table-cell">Sector</th>
              <th className="text-left p-3 font-medium">Prioridad</th>
              <th className="text-left p-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No tiene órdenes pendientes asignadas
                </td>
              </tr>
            ) : (
              ordenes.map((t) => (
                <tr
                  key={t.id}
                  className="border-t hover:bg-slate-50 cursor-pointer active:bg-slate-100"
                  onClick={() => router.push(`/tecnico/orden/${t.id}`)}
                >
                  <td className="p-3">
                    <span className="text-infinity-600 font-semibold">{t.codigo}</span>
                    <p className="text-xs text-slate-400 sm:hidden">{TIPO_LABELS[t.tipo]}</p>
                  </td>
                  <td className="p-3">
                    {t.programadoEn ? (
                      <span className="text-sm font-medium text-infinity-700">
                        {formatDateTime(t.programadoEn)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sin programar</span>
                    )}
                  </td>
                  <td className="p-3">{t.cliente.nombre}</td>
                  <td className="p-3 hidden sm:table-cell">{t.cliente.sector}</td>
                  <td className={cn("p-3", prioridadColor[t.prioridad])}>
                    {PRIORIDAD_LABELS[t.prioridad]}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {ESTADO_LABELS[t.estado] ?? t.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
