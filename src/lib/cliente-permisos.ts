import type { Rol } from "@prisma/client";

/** Ver / editar / crear clientes (CRM). */
export function puedeGestionarClientes(rol: Rol | string | null | undefined): boolean {
  return rol === "SUPERVISOR" || rol === "ADMIN";
}

/**
 * Eliminar clientes de forma permanente.
 * SUPERVISOR: no. Solo ADMIN (gerencia).
 */
export function puedeEliminarClientes(rol: Rol | string | null | undefined): boolean {
  return rol === "ADMIN";
}

/**
 * Importar CSV/Excel desde Wispro.
 * SUPERVISOR: no. Solo ADMIN (gerencia).
 */
export function puedeImportarWispro(rol: Rol | string | null | undefined): boolean {
  return rol === "ADMIN";
}

export function permisosClientes(rol: Rol | string | null | undefined) {
  return {
    gestionar: puedeGestionarClientes(rol),
    eliminar: puedeEliminarClientes(rol),
    importarWispro: puedeImportarWispro(rol),
  };
}

export const MSG_SOLO_ADMIN_ELIMINAR_CLIENTE =
  "El usuario supervisor no puede eliminar clientes. Solo gerencia (ADMIN).";

export const MSG_SOLO_ADMIN_IMPORTAR_WISPRO =
  "El usuario supervisor no puede importar Wispro (CSV/Excel). Solo gerencia (ADMIN).";
