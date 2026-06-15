"use client";

import { Package, AlertTriangle } from "lucide-react";
import {
  materialRequiereDetalle,
  TIPO_PATCHCORD_LABELS,
  tipoInventarioEfectivo,
} from "@/lib/material-detalle";
import { FIBRA_DROP_LIMITE_M } from "@/lib/fibra-excedente";
import type { MaterialReporteDTO } from "@/lib/materiales-reporte";
import { TIPO_LABELS } from "@/lib/utils";
import type { TipoPatchCord } from "@prisma/client";

export type { MaterialReporteDTO as MaterialReporteItem };

function prioridadMaterial(m: MaterialReporteDTO): number {
  const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
  if (tipo === "EQUIPO") return 0;
  if (materialRequiereDetalle(tipo, m.inventario.nombre)) return 1;
  return 2;
}

function etiquetaTipoMaterial(m: MaterialReporteDTO): string {
  const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
  if (tipo === "EQUIPO") return "Equipo";
  if (materialRequiereDetalle(tipo, m.inventario.nombre)) return "Trazable";
  return "Consumible";
}

function detalleIncompleto(m: MaterialReporteDTO): boolean {
  const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
  if (!materialRequiereDetalle(tipo, m.inventario.nombre)) return false;
  return !m.serie?.trim() || !m.modelo?.trim() || !m.marca?.trim();
}

interface MaterialesReporteProps {
  materiales: MaterialReporteDTO[];
  tipoTicket: string;
}

export function MaterialesReporte({ materiales, tipoTicket }: MaterialesReporteProps) {
  const equipos = materiales.filter((m) => prioridadMaterial(m) <= 1);
  const consumibles = materiales.filter((m) => prioridadMaterial(m) === 2);
  const tipoLabel = TIPO_LABELS[tipoTicket] ?? tipoTicket;

  return (
    <section
      id="reporte-materiales"
      className="bg-white rounded-xl border overflow-hidden print:break-inside-avoid"
    >
      <div className="bg-gradient-to-r from-infinity-800 to-infinity-700 px-4 py-3 text-white">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4" />
          Equipos y materiales utilizados
        </h3>
        <p className="text-infinity-100 text-xs mt-0.5">
          {tipoLabel} — detalle de equipos (serie, modelo, marca) e insumos descontados del inventario
        </p>
      </div>

      <div className="p-4 space-y-5">
        {materiales.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No se registró material en esta orden. El técnico debe usar &quot;Descontar del inventario&quot; en
            la app antes de cerrar el ticket.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="p-3 font-semibold">Material</th>
                    <th className="p-3 font-semibold w-20">Tipo</th>
                    <th className="p-3 font-semibold text-right w-24">Cantidad</th>
                    <th className="p-3 font-semibold w-28">Serie</th>
                    <th className="p-3 font-semibold w-28">Modelo</th>
                    <th className="p-3 font-semibold w-24">Marca</th>
                    <th className="p-3 font-semibold w-28">Patch cord</th>
                    <th className="p-3 font-semibold text-right w-28">Excedente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materiales.map((m) => {
                    const nombre = m.inventario?.nombre ?? "Material";
                    const unidad = m.inventario?.unidad ?? "unidad";
                    const patchLabel = m.tipoPatchCord
                      ? TIPO_PATCHCORD_LABELS[m.tipoPatchCord as TipoPatchCord]
                      : null;
                    const requiereDetalle = materialRequiereDetalle(
                      tipoInventarioEfectivo(m.inventario?.tipo, nombre),
                      nombre
                    );
                    const incompleto = detalleIncompleto(m);
                    const esEquipo = prioridadMaterial(m) <= 1;

                    return (
                      <tr
                        key={m.id}
                        className={
                          esEquipo
                            ? "bg-infinity-50/40 print:bg-slate-50"
                            : "hover:bg-slate-50/50"
                        }
                      >
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{nombre}</p>
                          {incompleto && (
                            <p className="text-[10px] text-amber-700 flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Detalle incompleto
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              esEquipo
                                ? "bg-infinity-100 text-infinity-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {etiquetaTipoMaterial(m)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-800 whitespace-nowrap">
                          {m.cantidad} {unidad}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {requiereDetalle ? (
                            <span className={m.serie ? "font-semibold text-slate-900" : "text-slate-400"}>
                              {m.serie || "—"}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {requiereDetalle ? (
                            <span className={m.modelo ? "font-semibold text-slate-900" : "text-slate-400"}>
                              {m.modelo || "—"}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {requiereDetalle ? (
                            <span className={m.marca ? "font-semibold text-slate-900" : "text-slate-400"}>
                              {m.marca || "—"}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-700">{patchLabel ?? "—"}</td>
                        <td className="p-3 text-right text-xs">
                          {m.excedenteMetros != null && m.excedenteMetros > 0 ? (
                            <span
                              className="text-red-700 font-semibold"
                              title={`Sobre ${FIBRA_DROP_LIMITE_M} m incluidos`}
                            >
                              +{m.excedenteMetros} m
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="rounded-lg bg-infinity-50 border border-infinity-100 px-3 py-2">
                <span className="font-semibold text-infinity-800">{equipos.length}</span>{" "}
                equipo(s) / material(es) trazable(s)
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="font-semibold text-slate-800">{consumibles.length}</span>{" "}
                consumible(s) e insumo(s)
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
