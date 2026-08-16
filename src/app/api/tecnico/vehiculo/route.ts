import { NextResponse } from "next/server";
import {
  asignacionAbiertaDeTecnico,
  requireTecnicoFlota,
} from "@/lib/parque-automotor/auth";
import {
  ALERTA_NO_APTO,
  alertaMantenimientoFecha,
  alertaMantenimientoKm,
  peorAlerta,
} from "@/lib/parque-automotor/reglas";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireTecnicoFlota();
  if (!auth.ok) return auth.response;
  const asig = await asignacionAbiertaDeTecnico(auth.tecnicoId);
  if (!asig) {
    return NextResponse.json({ vehiculo: null });
  }
  const lastMant = await prisma.mantenimientoVehiculo.findFirst({
    where: { vehiculoId: asig.vehiculoId, estadoRegistro: "ACTIVO" },
    orderBy: { fecha: "desc" },
  });
  const alerta = peorAlerta(
    alertaMantenimientoKm({
      kmActual: asig.vehiculo.kilometrajeActual,
      proximoKm: lastMant?.proximoKm,
    }),
    alertaMantenimientoFecha(lastMant?.proximoFecha)
  );
  const fueraServicio = asig.vehiculo.estado === "FUERA_SERVICIO";
  return NextResponse.json({
    vehiculo: {
      id: asig.vehiculo.id,
      placa: asig.vehiculo.placa,
      marca: asig.vehiculo.marca,
      modelo: asig.vehiculo.modelo,
      kilometraje: asig.vehiculo.kilometrajeActual,
      estado: asig.vehiculo.estado,
      asignacionId: asig.id,
      proximoMantenimientoKm: lastMant?.proximoKm ?? null,
      proximoMantenimientoFecha: lastMant?.proximoFecha ?? null,
      alertaMant: alerta,
      alertaNoApto: fueraServicio ? ALERTA_NO_APTO : null,
      bloqueadoCampo: fueraServicio,
    },
  });
}
