import type { TipoFoto } from "@prisma/client";

/**
 * Evidencia fija para Soporte Completo e Instalación nueva (4 fotos):
 * 1 NAP · 2 equipos instalados · 3 cliente satisfecho · 4 prueba de velocidad
 */
export const FOTOS_CLIENTE_COMPLETO: TipoFoto[] = [
  "NAP",
  "ONU",
  "CLIENTE_CONFORME",
  "SPEEDTEST",
];

export const FOTOS_ANTES_DEFAULT: TipoFoto[] = ["NAP"];
export const FOTOS_DURANTE_DEFAULT: TipoFoto[] = ["ONU"];
export const FOTOS_FINAL_DEFAULT: TipoFoto[] = ["CLIENTE_CONFORME", "SPEEDTEST"];

export const FOTOS_OBLIGATORIAS_DEFAULT: TipoFoto[] = [...FOTOS_CLIENTE_COMPLETO];
