import type { TipoFoto } from "@prisma/client";

export const FOTOS_ANTES_DEFAULT: TipoFoto[] = ["FACHADA", "POSTE", "NAP"];
export const FOTOS_DURANTE_DEFAULT: TipoFoto[] = ["TRABAJO", "EMPALME", "CAJA_TERMINAL"];
export const FOTOS_FINAL_DEFAULT: TipoFoto[] = ["ONU", "SPEEDTEST", "CLIENTE_CONFORME"];

export const FOTOS_OBLIGATORIAS_DEFAULT: TipoFoto[] = [
  "FACHADA",
  "POSTE",
  "NAP",
  "TRABAJO",
  "ONU",
  "SPEEDTEST",
  "CLIENTE_CONFORME",
];
