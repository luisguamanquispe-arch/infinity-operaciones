"use client";

import { ESTADO_TECNICO_LABELS } from "@/lib/utils";

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

interface Props {
  tecnicos: Tecnico[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}

export function TecnicoMultiSelect({ tecnicos, selected, onChange, label }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div>
      {label && <p className="text-xs text-slate-500 mb-2">{label}</p>}
      <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
        {tecnicos.length === 0 && (
          <p className="text-sm text-slate-400 px-2">No hay técnicos registrados</p>
        )}
        {tecnicos.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              onChange={() => toggle(t.id)}
              className="rounded border-slate-300 text-infinity-600"
            />
            <span className="font-medium">{t.nombre}</span>
            <span className="text-xs text-slate-400 ml-auto">
              {ESTADO_TECNICO_LABELS[t.estado] || t.estado}
            </span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-infinity-600 mt-1">
      {selected.length === 1
        ? "1 técnico seleccionado."
        : `${selected.length} técnicos seleccionados.`}
        </p>
      )}
    </div>
  );
}
