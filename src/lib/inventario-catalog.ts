import type { TipoInventario } from "@prisma/client";

export interface ItemInventario {
  nombre: string;
  unidad: string;
  stock: number;
  stockMin: number;
  tipo: TipoInventario;
}

/** Catálogo completo de materiales (seed + referencia). */
export const CATALOGO_INVENTARIO: ItemInventario[] = [
  { nombre: "Cable Drop", unidad: "m", stock: 5000, stockMin: 500, tipo: "CONSUMIBLE" },
  { nombre: "Conector SC/APC", unidad: "unidad", stock: 200, stockMin: 20, tipo: "CONSUMIBLE" },
  { nombre: "Conector mecanico", unidad: "unidad", stock: 300, stockMin: 40, tipo: "CONSUMIBLE" },
  { nombre: "Mangas", unidad: "unidad", stock: 300, stockMin: 50, tipo: "CONSUMIBLE" },
  { nombre: "Fibra ADSS", unidad: "m", stock: 10000, stockMin: 1000, tipo: "CONSUMIBLE" },
  { nombre: "Fibra ASUS", unidad: "m", stock: 5000, stockMin: 500, tipo: "CONSUMIBLE" },
  { nombre: "Fibra Droop", unidad: "m", stock: 8000, stockMin: 800, tipo: "CONSUMIBLE" },
  { nombre: "Amarras", unidad: "unidad", stock: 2000, stockMin: 200, tipo: "CONSUMIBLE" },
  { nombre: "Pinzas", unidad: "unidad", stock: 50, stockMin: 10, tipo: "CONSUMIBLE" },
  { nombre: "Ganchos de abonados", unidad: "unidad", stock: 500, stockMin: 80, tipo: "CONSUMIBLE" },
  { nombre: "Cintas metalicas", unidad: "unidad", stock: 300, stockMin: 40, tipo: "CONSUMIBLE" },
  { nombre: "Herrajes tipo A", unidad: "unidad", stock: 400, stockMin: 60, tipo: "CONSUMIBLE" },
  { nombre: "Brazos", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Roseta", unidad: "unidad", stock: 400, stockMin: 50, tipo: "CONSUMIBLE" },
  { nombre: "Pigtail UPC", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Pigtail APC", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Patch Cord", unidad: "unidad", stock: 100, stockMin: 15, tipo: "PATCHCORD" },
  { nombre: "Splitter", unidad: "unidad", stock: 80, stockMin: 15, tipo: "EQUIPO" },
  { nombre: "Caja NAP", unidad: "unidad", stock: 60, stockMin: 10, tipo: "EQUIPO" },
  { nombre: "ONU", unidad: "unidad", stock: 50, stockMin: 10, tipo: "EQUIPO" },
  { nombre: "Router", unidad: "unidad", stock: 30, stockMin: 5, tipo: "EQUIPO" },
  { nombre: "RB Mikrotik", unidad: "unidad", stock: 25, stockMin: 5, tipo: "EQUIPO" },
  { nombre: "Bridge", unidad: "unidad", stock: 20, stockMin: 5, tipo: "EQUIPO" },
  { nombre: "Repetidor", unidad: "unidad", stock: 20, stockMin: 5, tipo: "EQUIPO" },
  { nombre: "Otros", unidad: "unidad", stock: 100, stockMin: 0, tipo: "CONSUMIBLE" },
];

/** Materiales agregados para soporte de infraestructura (migración). */
export const MATERIALES_INFRAESTRUCTURA: ItemInventario[] = [
  { nombre: "Mangas", unidad: "unidad", stock: 300, stockMin: 50, tipo: "CONSUMIBLE" },
  { nombre: "Fibra ADSS", unidad: "m", stock: 10000, stockMin: 1000, tipo: "CONSUMIBLE" },
  { nombre: "Fibra ASUS", unidad: "m", stock: 5000, stockMin: 500, tipo: "CONSUMIBLE" },
  { nombre: "Caja NAP", unidad: "unidad", stock: 60, stockMin: 10, tipo: "EQUIPO" },
  { nombre: "Splitter", unidad: "unidad", stock: 80, stockMin: 15, tipo: "EQUIPO" },
  { nombre: "RB Mikrotik", unidad: "unidad", stock: 25, stockMin: 5, tipo: "EQUIPO" },
  { nombre: "Roseta", unidad: "unidad", stock: 400, stockMin: 50, tipo: "CONSUMIBLE" },
  { nombre: "Pigtail UPC", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Pigtail APC", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Fibra Droop", unidad: "m", stock: 8000, stockMin: 800, tipo: "CONSUMIBLE" },
  { nombre: "Amarras", unidad: "unidad", stock: 2000, stockMin: 200, tipo: "CONSUMIBLE" },
  { nombre: "Pinzas", unidad: "unidad", stock: 50, stockMin: 10, tipo: "CONSUMIBLE" },
  { nombre: "Ganchos de abonados", unidad: "unidad", stock: 500, stockMin: 80, tipo: "CONSUMIBLE" },
  { nombre: "Cintas metalicas", unidad: "unidad", stock: 300, stockMin: 40, tipo: "CONSUMIBLE" },
  { nombre: "Herrajes tipo A", unidad: "unidad", stock: 400, stockMin: 60, tipo: "CONSUMIBLE" },
  { nombre: "Brazos", unidad: "unidad", stock: 200, stockMin: 30, tipo: "CONSUMIBLE" },
  { nombre: "Otros", unidad: "unidad", stock: 100, stockMin: 0, tipo: "CONSUMIBLE" },
];
