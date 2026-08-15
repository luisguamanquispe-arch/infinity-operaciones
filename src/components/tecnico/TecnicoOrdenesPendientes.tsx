"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIORIDAD_LABELS, TIPO_LABELS, formatDateTime } from "@/lib/utils";
import { TicketSemaforo } from "@/components/TicketSemaforo";

export interface OrdenPendiente {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn?: string | null;
  cliente: { nombre: string; sector: string };
  diasSinAtencion?: number;
}

interface Props {
  ordenes: OrdenPendiente[];
  emptyLabel?: string;
}

const prioridadColor: Record<string, string> = {
  ALTA: "text-red-600 font-semibold",
  MEDIA: "text-amber-600",
  BAJA: "text-slate-500",
};

/** Lista de órdenes activas del técnico (por leer / leído / en proceso). */
export function TecnicoOrdenesPendientes({ ordenes, emptyLabel }: Props) {
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
              <th className="text-left p-3 font-medium">Semáforo</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  {emptyLabel ??
                    "No tiene órdenes activas asignadas. El supervisor debe destinarle tickets."}
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
                    {typeof t.diasSinAtencion === "number" && (
                      <p className="text-[11px] text-red-700">{t.diasSinAtencion} días sin atención</p>
                    )}
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
                    <TicketSemaforo estado={t.estado} />
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
