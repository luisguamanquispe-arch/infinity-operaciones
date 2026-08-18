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
import { estadoVehiculoVisible } from "@/lib/parque-automotor/labels";
import { hojaDeVida } from "@/lib/parque-automotor/servicio";
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
  const ficha = await hojaDeVida(asig.vehiculoId);
  const visible = estadoVehiculoVisible(asig.vehiculo.estado);
  return NextResponse.json({
    vehiculo: {
      id: asig.vehiculo.id,
      placa: asig.vehiculo.placa,
      marca: asig.vehiculo.marca,
      modelo: asig.vehiculo.modelo,
      anio: asig.vehiculo.anio,
      color: asig.vehiculo.color,
      kilometraje: asig.vehiculo.kilometrajeActual,
      estado: asig.vehiculo.estado,
      estadoVisible: visible.label,
      estadoClave: visible.clave,
      asignacionId: asig.id,
      fechaAsignacion: asig.fechaInicio,
      tecnicoNombre: asig.tecnico.usuario.nombre,
      proximoMantenimientoKm: lastMant?.proximoKm ?? null,
      proximoMantenimientoFecha: lastMant?.proximoFecha ?? null,
      alertaMant: alerta,
      alertaNoApto: fueraServicio ? ALERTA_NO_APTO : null,
      bloqueadoCampo: fueraServicio,
    },
    historial: ficha.timeline,
    lecturasKm: ficha.lecturasKm,
    cargasCombustible: ficha.cargasCombustible,
    novedades: ficha.novedades,
    inspecciones: ficha.inspecciones,
    mantenimientos: ficha.mantenimientos,
  });
}
