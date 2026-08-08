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
  | "no_atendidos"
  | "clientes"
  | "reportes"
  | "tecnicos"
  | "tecnicos_nuevo"
  | "usuarios"
  | "backup"
  | "eliminar_soportes"
  | "tecnico_home";

export type NavContext =
  | "gerencia"
  | "supervisor"
  | "home-tiles"
  | "help-desk"
  | "acciones";

/** Hubs principales para saltar entre módulos (barra sticky). */
export type HubId =
  | "gerencia"
  | "operaciones"
  | "soporte_infra"
  | "soporte_remoto"
  | "clientes"
  | "reportes";

export type HubDef = {
  id: HubId;
  href: string;
  label: string;
  shortLabel: string;
  roles: Rol[];
  /** Prefijos de ruta; el hub activo es el de mayor longitud que coincida. */
  matchPrefixes: string[];
};

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
  // —— Acciones de campo (NO hubs: Infra/Remoto/CRM/Reportes solo en ModuleSwitcher)
  {
    id: "ticket_soporte",
    href: "/supervisor/tickets/nuevo",
    label: "+ Ticket soporte",
    group: "campo",
    tone: "primary",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["home-tiles", "acciones"],
    order: 100,
    homeIcon: "plus",
  },
  {
    id: "asignaciones",
    href: "/supervisor/asignaciones",
    label: "Destinar tickets",
    group: "campo",
    tone: "emerald",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["home-tiles", "acciones"],
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
    contexts: ["home-tiles", "acciones"],
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
    contexts: ["home-tiles", "acciones"],
    order: 140,
    homeIcon: "bell",
  },
  {
    id: "no_atendidos",
    href: "/supervisor/no-atendidos",
    label: "No atendidos (+4d)",
    group: "campo",
    tone: "amber",
    roles: ["ADMIN", "SUPERVISOR"],
    contexts: ["home-tiles", "acciones"],
    order: 145,
    homeIcon: "bell",
  },
];

/**
 * Barra de módulos: acceso único a cada hub de producto.
 * No deben repetirse en tiles ni en GerenciaQuickNav.
 */
export const HUBS: HubDef[] = [
  {
    id: "gerencia",
    href: "/gerencia",
    label: "Gerencia",
    shortLabel: "Gerencia",
    roles: ["ADMIN"],
    matchPrefixes: ["/gerencia"],
  },
  {
    id: "operaciones",
    href: "/supervisor",
    label: "Operaciones",
    shortLabel: "Campo",
    roles: ["ADMIN", "SUPERVISOR"],
    matchPrefixes: ["/supervisor"],
  },
  {
    id: "soporte_infra",
    href: "/supervisor/soporte-infraestructura",
    label: "Infraestructura",
    shortLabel: "Infra",
    roles: ["ADMIN", "SUPERVISOR"],
    matchPrefixes: [
      "/supervisor/soporte-infraestructura",
      "/supervisor/tickets/nuevo-infraestructura",
    ],
  },
  {
    id: "soporte_remoto",
    href: "/help-desk",
    label: "Soporte Remoto",
    shortLabel: "Remoto",
    roles: ["ADMIN", "SUPERVISOR", "HELP_DESK"],
    matchPrefixes: ["/help-desk", "/soporte-remoto"],
  },
  {
    id: "clientes",
    href: "/supervisor/clientes",
    label: "Clientes",
    shortLabel: "CRM",
    roles: ["ADMIN", "SUPERVISOR"],
    matchPrefixes: ["/supervisor/clientes"],
  },
  {
    id: "reportes",
    href: "/reportes",
    label: "Reportes",
    shortLabel: "Reportes",
    roles: ["ADMIN", "SUPERVISOR"],
    matchPrefixes: ["/reportes"],
  },
];

export function hubsParaRol(rol: Rol | string | null | undefined): HubDef[] {
  if (!rol) return [];
  return HUBS.filter((h) => h.roles.includes(rol as Rol));
}

/** Hub activo: el que tenga el prefijo coincidente más largo. */
export function hubActivo(
  pathname: string,
  rol: Rol | string | null | undefined
): HubId | null {
  const hubs = hubsParaRol(rol);
  let best: HubDef | null = null;
  let bestLen = -1;
  for (const h of hubs) {
    for (const prefix of h.matchPrefixes) {
      if (
        (pathname === prefix || pathname.startsWith(prefix + "/")) &&
        prefix.length > bestLen
      ) {
        best = h;
        bestLen = prefix.length;
      }
    }
  }
  return best?.id ?? null;
}

export function puedeUsarModuleSwitcher(
  rol: Rol | string | null | undefined
): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR" || rol === "HELP_DESK";
}

/** Hrefs de hubs — un solo acceso por módulo de producto. */
export function hubHrefs(): Set<string> {
  return new Set(HUBS.map((h) => h.href.replace(/\/$/, "") || "/"));
}

export function esHrefDeHub(href: string): boolean {
  const norm = href.replace(/\/$/, "") || "/";
  return hubHrefs().has(norm);
}

/**
 * Ítems de menú sin repetir hubs ni duplicar el mismo href.
 * Usar en tiles / quick-nav / acciones (la barra sticky es el único acceso a hubs).
 */
export function navItemsSinRepetir(
  rol: Rol | string | null | undefined,
  context: NavContext,
  opts?: { totalTecnicos?: number }
): NavItemResolved[] {
  const seenHref = new Set<string>();
  const seenId = new Set<string>();
  const out: NavItemResolved[] = [];
  for (const item of navItemsPara(rol, context, opts)) {
    if (esHrefDeHub(item.href)) continue;
    if (seenId.has(item.id)) continue;
    const hrefKey = item.href.replace(/\/$/, "") || "/";
    if (seenHref.has(hrefKey)) continue;
    seenId.add(item.id);
    seenHref.add(hrefKey);
    out.push(item);
  }
  return out;
}

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
