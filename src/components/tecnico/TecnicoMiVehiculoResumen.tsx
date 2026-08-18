"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Car } from "lucide-react";

type V = {
  placa: string;
  marca: string;
  modelo: string;
  kilometraje: number;
  estado: string;
  proximoMantenimientoKm: number | null;
  alertaNoApto?: string | null;
  bloqueadoCampo?: boolean;
};

export function TecnicoMiVehiculoResumen() {
  const [vehiculo, setVehiculo] = useState<V | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/tecnico/vehiculo")
      .then((r) => r.json())
      .then((j) => setVehiculo(j.vehiculo ?? null))
      .catch(() => setVehiculo(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <section>
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <Car className="w-5 h-5" />
        Mi vehículo
      </h2>
      {!vehiculo ? (
        <p className="text-sm text-slate-500">No tiene un vehículo asignado.</p>
      ) : (
        <Link
          href="/tecnico/vehiculo"
          className="block border rounded-xl p-4 bg-white hover:bg-slate-50"
        >
          <p className="font-medium">
            {vehiculo.placa} · {vehiculo.marca} {vehiculo.modelo}
          </p>
          <p className="text-sm text-slate-600">
            {vehiculo.kilometraje} km · {vehiculo.estado}
            {vehiculo.proximoMantenimientoKm
              ? ` · próximo mantenimiento ${vehiculo.proximoMantenimientoKm} km`
              : ""}
          </p>
          {vehiculo.bloqueadoCampo || vehiculo.estado === "FUERA_SERVICIO" ? (
            <p className="text-xs text-red-700 mt-1 font-medium">
              {vehiculo.alertaNoApto || "El vehículo está FUERA DE SERVICIO y no puede registrar operaciones."}
            </p>
          ) : (
          <p className="text-xs text-infinity-700 mt-1">
            Kilometraje · Gasolina · Reportar daño · Inspección
          </p>
          )}
        </Link>
      )}
    </section>
  );
}
