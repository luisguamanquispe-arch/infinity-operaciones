/** Calcula minutos entre inicio y fin; null si faltan o fin < inicio. */
export function calcularTiempoMinutos(
  horaInicio: Date | null | undefined,
  horaFin: Date | null | undefined
): number | null {
  if (!horaInicio || !horaFin) return null;
  const ms = horaFin.getTime() - horaInicio.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}
