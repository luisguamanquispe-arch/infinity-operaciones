"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, CheckCircle2, Package } from "lucide-react";
import {
  CATALOGO_MATERIALES_INSTALACION,
  EQUIPOS_INSTALACION,
  LABELS_OTROS_GENERICOS,
  MATERIALES_CONSUMIBLES_INSTALACION,
  UNIDADES_MATERIAL_INSTALACION,
  validarMaterialesInstalacion,
  type CategoriaMaterialInstalacion,
} from "@/lib/nueva-instalacion";

export interface MaterialInstalacionRow {
  id?: string;
  categoria: CategoriaMaterialInstalacion;
  item: string;
  esOtro: boolean;
  cantidad: string;
  unidad: string;
  marca: string;
  series: string[];
}

function esItemOtroCatalogo(item: string): boolean {
  const limpio = item.trim();
  if (!limpio) return true;
  if (LABELS_OTROS_GENERICOS.has(limpio.toLowerCase())) return true;
  return !CATALOGO_MATERIALES_INSTALACION.some((c) => c.label === limpio);
}

function crearFilaInicial(): MaterialInstalacionRow {
  return {
    categoria: "MATERIAL",
    item: "Fibra óptica",
    esOtro: false,
    cantidad: "1",
    unidad: "metros",
    marca: "",
    series: [],
  };
}

function normalizarFilasDesdeProps(
  inicial:
    | Array<{
        id?: string;
        categoria: string;
        item: string;
        cantidad: number;
        unidad: string;
        marca: string | null;
        series: string[];
      }>
    | undefined
): MaterialInstalacionRow[] {
  if (!inicial || inicial.length === 0) return [crearFilaInicial()];
  return inicial.map((m) => {
    const esOtro = esItemOtroCatalogo(m.item);
    return {
      id: m.id,
      categoria: m.categoria === "EQUIPO" ? "EQUIPO" : "MATERIAL",
      item: LABELS_OTROS_GENERICOS.has(m.item.trim().toLowerCase()) ? "" : m.item,
      esOtro,
      cantidad: String(m.cantidad),
      unidad: m.unidad,
      marca: m.marca ?? "",
      series: Array.isArray(m.series) ? [...m.series] : [],
    };
  });
}

export function MaterialesInstalacionForm({
  ticketId,
  initialItems,
  editable,
  onSaved,
}: {
  ticketId: string;
  initialItems?: Array<{
    id?: string;
    categoria: string;
    item: string;
    cantidad: number;
    unidad: string;
    marca: string | null;
    series: string[];
  }>;
  editable: boolean;
  onSaved?: (
    saved: Array<{
      id: string;
      categoria: string;
      item: string;
      cantidad: number;
      unidad: string;
      marca: string | null;
      series: string[];
    }>
  ) => void;
}) {
  const [rows, setRows] = useState<MaterialInstalacionRow[]>(() =>
    normalizarFilasDesdeProps(initialItems)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setRows(normalizarFilasDesdeProps(initialItems));
    }
  }, [initialItems]);

  function actualizarFila(idx: number, patch: Partial<MaterialInstalacionRow>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        if (next.categoria === "EQUIPO") {
          const rawCant = next.cantidad.trim();
          if (rawCant === "") {
            // Mantener las series ya ingresadas mientras el usuario borra temporalmente la cantidad
            next.series = next.series.length > 0 ? [...next.series] : [""];
          } else {
            const parsed = Number(rawCant);
            if (Number.isInteger(parsed) && parsed >= 1) {
              const series = [...next.series];
              while (series.length < parsed) series.push("");
              next.series = series.slice(0, parsed);
            } else {
              next.series = next.series.length > 0 ? [...next.series] : [""];
            }
          }
        } else {
          next.marca = "";
          next.series = [];
        }
        return next;
      })
    );
  }

  function seleccionarCatalogo(idx: number, label: string) {
    const found = CATALOGO_MATERIALES_INSTALACION.find((c) => c.label === label);
    if (!found) {
      actualizarFila(idx, { item: label, esOtro: true });
      return;
    }
    const esOtro = LABELS_OTROS_GENERICOS.has(found.label.toLowerCase());
    const currentRow = rows[idx];
    const preserveSeries =
      found.categoria === "EQUIPO" && currentRow?.categoria === "EQUIPO" && currentRow.series.length > 0
        ? currentRow.series
        : found.categoria === "EQUIPO"
          ? [""]
          : [];
    actualizarFila(idx, {
      item: esOtro ? "" : found.label,
      esOtro,
      categoria: found.categoria,
      unidad: found.unidadDefault,
      cantidad:
        found.categoria === "EQUIPO"
          ? currentRow?.categoria === "EQUIPO" && currentRow.cantidad.trim() !== ""
            ? currentRow.cantidad
            : "1"
          : currentRow?.cantidad || "1",
      series: preserveSeries,
    });
  }

  function agregarFila() {
    setRows((prev) => [...prev, crearFilaInicial()]);
    setOkMsg("");
  }

  function eliminarFila(idx: number) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setOkMsg("");
  }

  async function guardar() {
    setError("");
    setOkMsg("");
    const payload = rows.map((r) => ({
      categoria: r.categoria,
      item: r.item,
      cantidad: Number(r.cantidad),
      unidad: r.unidad,
      marca: r.categoria === "EQUIPO" ? r.marca : null,
      series: r.categoria === "EQUIPO" ? r.series : [],
    }));
    const val = validarMaterialesInstalacion(payload);
    if (!val.ok) {
      setError(val.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/materiales-instalacion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar el registro de materiales.");
        return;
      }
      setOkMsg("Materiales y equipos guardados correctamente.");
      if (onSaved && Array.isArray(data.materialesInstalacion)) {
        onSaved(data.materialesInstalacion);
      }
    } catch {
      setError("Error de conexión al guardar los materiales.");
    } finally {
      setSaving(false);
    }
  }

  if (!editable) {
    const items = initialItems ?? [];
    return (
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-infinity-600" />
          Materiales y equipos utilizados en la instalación
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Sin materiales ni equipos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">Material / Equipo</th>
                  <th className="py-2 px-2">Cantidad</th>
                  <th className="py-2 px-2">Unidad</th>
                  <th className="py-2 px-2">Marca</th>
                  <th className="py-2 px-2">Serie(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((m, idx) => (
                  <tr key={m.id ?? idx}>
                    <td className="py-2 px-2 font-medium">
                      {m.categoria === "EQUIPO" ? "Equipo" : "Material"}
                    </td>
                    <td className="py-2 px-2">{m.item}</td>
                    <td className="py-2 px-2 font-mono">{m.cantidad}</td>
                    <td className="py-2 px-2">{m.unidad}</td>
                    <td className="py-2 px-2">{m.marca || "—"}</td>
                    <td className="py-2 px-2 font-mono">
                      {m.series?.length ? m.series.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-infinity-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-slate-900">
            <Package className="w-4 h-4 text-infinity-600" />
            Materiales y equipos utilizados en la instalación *
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Obligatorio para finalizar una Nueva instalación. Los equipos requieren marca y serie
            individual.
          </p>
        </div>
        <button
          type="button"
          onClick={agregarFila}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-infinity-50 hover:bg-infinity-100 text-infinity-700 border border-infinity-200 text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar material/equipo
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => {
          const esEquipo = row.categoria === "EQUIPO";
          const esOtro = row.esOtro;
          return (
            <div
              key={idx}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  Registro #{idx + 1} · {esEquipo ? "Equipo" : "Material consumible"}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarFila(idx)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="text-xs text-slate-500">Material o equipo *</label>
                  <select
                    value={
                      esOtro
                        ? esEquipo
                          ? "Otros equipos utilizados"
                          : "Otros materiales utilizados"
                        : row.item
                    }
                    onChange={(e) => seleccionarCatalogo(idx, e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white mt-0.5"
                  >
                    <optgroup label="Materiales consumibles">
                      {MATERIALES_CONSUMIBLES_INSTALACION.map((m) => (
                        <option key={m.id} value={m.label}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Equipos">
                      {EQUIPOS_INSTALACION.map((eq) => (
                        <option key={eq.id} value={eq.label}>
                          {eq.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500">Cantidad utilizada *</label>
                  <input
                    type="number"
                    min={esEquipo ? 1 : 0.01}
                    step={esEquipo ? 1 : "any"}
                    value={row.cantidad}
                    onChange={(e) => actualizarFila(idx, { cantidad: e.target.value })}
                    className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Unidad de medida *</label>
                  <select
                    value={row.unidad}
                    onChange={(e) => actualizarFila(idx, { unidad: e.target.value })}
                    className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white mt-0.5"
                  >
                    {UNIDADES_MATERIAL_INSTALACION.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {esOtro && (
                <div>
                  <label className="text-xs text-slate-500">
                    Nombre específico del {esEquipo ? "equipo" : "material"} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={esEquipo ? "Ej. Switch 8 puertos" : "Ej. Cinta aislante"}
                    value={row.item}
                    onChange={(e) => actualizarFila(idx, { item: e.target.value, esOtro: true })}
                    className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white mt-0.5"
                  />
                </div>
              )}

              {esEquipo && (
                <div className="space-y-2 border-t border-slate-200 pt-2.5">
                  <div>
                    <label className="text-xs text-slate-500">Marca *</label>
                    <input
                      type="text"
                      placeholder="Ej. Huawei, TP-Link, ZTE"
                      value={row.marca}
                      onChange={(e) => actualizarFila(idx, { marca: e.target.value })}
                      className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white mt-0.5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500">
                      Número(s) de serie * ({row.series.length} requerido
                      {row.series.length === 1 ? "" : "s"})
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {row.series.map((serie, sIdx) => (
                        <input
                          key={sIdx}
                          type="text"
                          placeholder={`Serie equipo #${sIdx + 1}`}
                          value={serie}
                          onChange={(e) => {
                            const nextSeries = [...row.series];
                            nextSeries[sIdx] = e.target.value;
                            actualizarFila(idx, { series: nextSeries });
                          }}
                          className="w-full px-2.5 py-2 border rounded-lg text-sm font-mono bg-white"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {okMsg}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={saving}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-infinity-600 hover:bg-infinity-700 text-white text-sm font-medium disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? "Guardando materiales…" : "Guardar materiales y equipos"}
      </button>
    </section>
  );
}
