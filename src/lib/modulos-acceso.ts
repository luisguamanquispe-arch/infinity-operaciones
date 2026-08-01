import type { Rol } from "@prisma/client";

/** Home por rol (espejo de dashboardPath en auth.ts; sin imports server-only). */
export function homePathPorRol(rol: Rol | string | null | undefined): string {
  switch (rol) {
    case "TECNICO":
      return "/tecnico";
    case "HELP_DESK":
      return "/help-desk";
    case "SUPERVISOR":
      return "/supervisor";
    case "ADMIN":
      return "/gerencia";
    default:
      return "/login";
  }
}

/** Identificadores de módulos de producto (una fuente de verdad para menús). */
export type ModuloId =
  | "gerencia_home"
  | "operaciones"
  | "ticket_soporte"
  | "soporte_infra"
  | "soporte_remoto"
  | "asignaciones"
  | "calendario"
  | "novedades"
  | "clientes"
  | "reportes"
  | "tecnicos"
  | "tecnicos_nuevo"
  | "usuarios"
  | "backup"
  | "eliminar_soportes"
  | "tecnico_home";

export type NavContext = "gerencia" | "supervisor" | "home-tiles" | "help-desk";

export type NavTone =
  | "primary"
  | "violet"
  | "teal"
  | "emerald"
  | "amber"
  | "sky"
  | "red"
  | "outline"
  | "purple"
  | "white";

export type NavGroup = "admin" | "campo" | "oficina" | "crm" | "sistema";

export type ModuloDef = {
  id: ModuloId;
  href: string;
  label: string;
  /** Etiqueta alternativa para admin (p. ej. Wispro). */
  labelAdmin?: string;
  group: NavGroup;
  tone: NavTone;
  /** Roles con acceso al módulo (middleware / menú). */
  roles: Rol[];
  /** Dónde aparece el enlace. */
  contexts: NavContext[];
  /** Orden dentro del menú (menor = primero). */
  order: number;
  /** CTA grande en home supervisor. */
  homeIcon?: "plus" | "calendar" | "file" | "users" | "contact" | "bell";
};

/**
 * Matriz de módulos.
 * - ADMIN: gerencia + operaciones campo + oficina
 * - SUPERVISOR: operaciones campo + oficina (sin admin)
 * - HELP_DESK: solo Soporte Remoto
 * - TECNICO: solo app técnico (sin menú cruzado)
 */
export const MODULOS: ModuloDef[] = [
  // —— Administración (solo ADMIN)
  {
    id: "tecnicos_nuevo",
    href: "/gerencia/tecnicos/nuevo",
    label: "+ Nuevo técnico",
    group: "admin",
    tone: "primary",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 10,
  },
  {
    id: "tecnicos",
    href: "/gerencia/tecnicos",
    label: "Técnicos",
    group: "admin",
    tone: "outline",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 20,
  },
  {
    id: "eliminar_soportes",
    href: "/gerencia/soportes",
    label: "Eliminar soportes",
    group: "admin",
    tone: "red",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 30,
  },
  {
    id: "usuarios",
    href: "/gerencia/usuarios",
    label: "Usuarios y claves",
    group: "admin",
    tone: "purple",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 40,
  },
  {
    id: "backup",
    href: "/gerencia/backup",
    label: "Backup / Restore",
    group: "admin",
    tone: "amber",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 50,
  },
  {
    id: "operaciones",
    href: "/supervisor",
    label: "Panel operaciones",
    group: "campo",
    tone: "emerald",
    roles: ["ADMIN"],
    contexts: ["gerencia"],
    order: 60,
  },

  // —— Campo / operaciones (ADMIN + SUPERVISOR)
  {
    id: "ticket_soporte",
    href: "/supervisor/tickets/nuevo",
    label: "+ Ticket soporte",
    group: "campo",
    tone: "primary",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["supervisor", "home-tiles"],
    order: 100,
    homeIcon: "plus",
  },
  {
    id: "soporte_infra",
    href: "/supervisor/soporte-infraestructura",
    label: "Soporte de Infraestructura",
    group: "campo",
    tone: "violet",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["gerencia", "supervisor", "home-tiles"],
    order: 110,
    homeIcon: "plus",
  },
  {
    id: "soporte_remoto",
    href: "/help-desk",
    label: "Soporte Remoto",
    group: "oficina",
    tone: "teal",
    roles: ["ADMIN", "SUPERVISOR", "HELP_DESK"],
    contexts: ["gerencia", "supervisor", "home-tiles", "help-desk"],
    order: 115,
    homeIcon: "plus",
  },
  {
    id: "asignaciones",
    href: "/supervisor/asignaciones",
    label: "Destinar tickets",
    group: "campo",
    tone: "emerald",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["supervisor", "home-tiles"],
    order: 120,
    homeIcon: "users",
  },
  {
    id: "calendario",
    href: "/supervisor/calendario",
    label: "Calendario",
    group: "campo",
    tone: "outline",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["supervisor", "home-tiles"],
    order: 130,
    homeIcon: "calendar",
  },
  {
    id: "novedades",
    href: "/supervisor/novedades",
    label: "Novedades soporte",
    group: "campo",
    tone: "amber",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["supervisor", "home-tiles"],
    order: 140,
    homeIcon: "bell",
  },
  {
    id: "reportes",
    href: "/reportes",
    label: "Reportes finalizados",
    group: "sistema",
    tone: "outline",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["gerencia", "supervisor", "home-tiles"],
    order: 150,
    homeIcon: "file",
  },

  // —— CRM
  {
    id: "clientes",
    href: "/supervisor/clientes",
    label: "Clientes CRM",
    labelAdmin: "Clientes CRM / Importar Wispro",
    group: "crm",
    tone: "sky",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["gerencia", "supervisor", "home-tiles"],
    order: 300,
    homeIcon: "contact",
  },
];

export function puedeAccederModulo(
  rol: Rol | string | null | undefined,
  moduloId: ModuloId
): boolean {
  if (!rol) return false;
  const mod = MODULOS.find((m) => m.id === moduloId);
  if (!mod) return false;
  return mod.roles.includes(rol as Rol);
}

export type NavItemResolved = ModuloDef & { labelResolved: string };

/** Ítems de menú para un rol y contexto, ordenados. */
export function navItemsPara(
  rol: Rol | string | null | undefined,
  context: NavContext,
  opts?: { totalTecnicos?: number }
): NavItemResolved[] {
  if (!rol) return [];
  return MODULOS.filter(
    (m) => m.roles.includes(rol as Rol) && m.contexts.includes(context)
  )
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      let labelResolved =
        rol === "ADMIN" && m.labelAdmin ? m.labelAdmin : m.label;
      if (m.id === "tecnicos" && opts?.totalTecnicos != null) {
        labelResolved = `Técnicos (${opts.totalTecnicos})`;
      }
      return { ...m, labelResolved };
    });
}

/** Volver al panel correcto según rol (reportes, help-desk, etc.). */
export function panelHomeHref(rol: Rol | string | null | undefined): string {
  if (!rol || rol === "CLIENTE") return "/login";
  return homePathPorRol(rol);
}

export function panelHomeLabel(rol: Rol | string | null | undefined): string {
  switch (rol) {
    case "ADMIN":
      return "Volver a gerencia";
    case "SUPERVISOR":
      return "Volver al panel supervisor";
    case "HELP_DESK":
      return "Volver a Soporte Remoto";
    case "TECNICO":
      return "Volver a mis órdenes";
    default:
      return "Volver";
  }
}

/** Agrupa ítems para menús con secciones. */
export function agruparNavItems(items: NavItemResolved[]): {
  group: NavGroup;
  title: string;
  items: NavItemResolved[];
}[] {
  const titles: Record<NavGroup, string> = {
    admin: "Administración",
    campo: "Operaciones de campo",
    oficina: "Oficina",
    crm: "Clientes",
    sistema: "Reportes",
  };
  const order: NavGroup[] = ["admin", "campo", "oficina", "crm", "sistema"];
  return order
    .map((group) => ({
      group,
      title: titles[group],
      items: items.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);
}
