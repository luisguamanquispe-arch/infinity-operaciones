"use client";

import { Package, Cpu, Cable } from "lucide-react";
import {
  materialRequiereDetalle,
  TIPO_PATCHCORD_LABELS,
  tipoInventarioEfectivo,
} from "@/lib/material-detalle";
import { FIBRA_DROP_LIMITE_M } from "@/lib/fibra-excedente";
import type { TipoInventario, TipoPatchCord } from "@prisma/client";

export interface MaterialReporteItem {
  id: string;
  cantidad: number;
  serie: string | null;
  modelo: string | null;
  marca: string | null;
  tipoPatchCord: string | null;
  excedenteMetros: number | null;
  inventario: { nombre: string; unidad: string; tipo?: TipoInventario };
}

function clasificarMaterial(m: MaterialReporteItem) {
  const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
  const conDetalle = materialRequiereDetalle(tipo, m.inventario.nombre);
  return { tipo, conDetalle };
}

function DetalleEquipo({ m }: { m: MaterialReporteItem }) {
  const patchLabel = m.tipoPatchCord
    ? TIPO_PATCHCORD_LABELS[m.tipoPatchCord as TipoPatchCord]
    : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-slate-900">{m.inventario.nombre}</p>
          <p className="text-xs text-slate-500 mt-0.5">Equipo / material trazable</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-infinity-100 px-3 py-1 text-sm font-semibold text-infinity-800">
          {m.cantidad} {m.inventario.unidad}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-md bg-white border border-slate-100 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Serie</dt>
          <dd className="font-mono font-semibold text-slate-900 mt-0.5">{m.serie || "—"}</dd>
        </div>
        <div className="rounded-md bg-white border border-slate-100 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Modelo</dt>
          <dd className="font-semibold text-slate-900 mt-0.5">{m.modelo || "—"}</dd>
        </div>
        <div className="rounded-md bg-white border border-slate-100 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Marca</dt>
          <dd className="font-semibold text-slate-900 mt-0.5">{m.marca || "—"}</dd>
        </div>
      </dl>

      {(patchLabel || (m.excedenteMetros && m.excedenteMetros > 0)) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {patchLabel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2.5 py-1 font-medium text-violet-800">
              <Cable className="w-3 h-3" />
              Patch cord: {patchLabel}
            </span>
          )}
          {m.excedenteMetros != null && m.excedenteMetros > 0 && (
            <span className="inline-flex rounded-md bg-red-100 px-2.5 py-1 font-semibold text-red-800">
              Excedente fibra: +{m.excedenteMetros} m (sobre {FIBRA_DROP_LIMITE_M} m incluidos)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface MaterialesReporteProps {
  materiales: MaterialReporteItem[];
}

export function MaterialesReporte({ materiales }: MaterialesReporteProps) {
  if (materiales.length === 0) return null;

  const equipos: MaterialReporteItem[] = [];
  const consumibles: MaterialReporteItem[] = [];

  for (const m of materiales) {
    const { conDetalle } = clasificarMaterial(m);
    if (conDetalle || m.serie || m.modelo || m.marca) {
      equipos.push(m);
    } else {
      consumibles.push(m);
    }
  }

  return (
    <section className="bg-white rounded-xl border overflow-hidden print:break-inside-avoid">
      <div className="bg-gradient-to-r from-infinity-800 to-infinity-700 px-4 py-3 text-white">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4" />
          Material utilizado
        </h3>
        <p className="text-infinity-100 text-xs mt-0.5">
          Equipos con serie, modelo y marca · consumibles e insumos
        </p>
      </div>

      <div className="p-4 space-y-6">
        {equipos.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-infinity-600" />
              Equipos y materiales con trazabilidad
              <span className="text-xs font-normal text-slate-400">({equipos.length})</span>
            </h4>
            <div className="space-y-3">
              {equipos.map((m) => (
                <DetalleEquipo key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}

        {consumibles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              Consumibles e insumos
              <span className="text-xs font-normal text-slate-400">({consumibles.length})</span>
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="p-3 font-semibold">Material</th>
                    <th className="p-3 font-semibold text-right">Cantidad</th>
                    <th className="p-3 font-semibold text-right">Excedente fibra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consumibles.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-800">{m.inventario.nombre}</td>
                      <td className="p-3 text-right text-slate-700">
                        {m.cantidad} {m.inventario.unidad}
                      </td>
                      <td className="p-3 text-right">
                        {m.excedenteMetros != null && m.excedenteMetros > 0 ? (
                          <span className="text-red-700 font-semibold">+{m.excedenteMetros} m</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
