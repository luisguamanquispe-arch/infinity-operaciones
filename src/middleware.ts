import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { SPLASH_COOKIE_NAME, SPLASH_RUTA, esLoginWebOperaciones } from "@/lib/splash-web";

const publicPaths = [
  "/login",
  "/intro",
  "/manifest.json",
  "/api/setup/seed",
  "/api/setup/eliminar-tickets",
  "/api/health",
];

function dashboardPath(rol: string): string {
  switch (rol) {
    case "TECNICO":
      return "/tecnico";
    case "SUPERVISOR":
      return "/supervisor";
    case "ADMIN":
      return "/gerencia";
    default:
      return "/login";
  }
}

/** Login de app técnico (PWA/Capacitor) vs panel web. */
function loginRedirect(request: NextRequest, fromTecnico = false) {
  const path = fromTecnico || request.nextUrl.pathname.startsWith("/tecnico")
    ? "/login?app=tecnico"
    : "/login";
  return NextResponse.redirect(new URL(path, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esRutaTecnico = pathname.startsWith("/tecnico");

  // Primera visita web: /login → /intro (video de bienvenida, una sola vez)
  if (
    pathname === "/login" &&
    esLoginWebOperaciones(request.nextUrl.search) &&
    request.cookies.get(SPLASH_COOKIE_NAME)?.value !== "1"
  ) {
    const intro = new URL(SPLASH_RUTA, request.url);
    intro.searchParams.set("next", "/login");
    return NextResponse.redirect(intro);
  }

  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname === "/" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    if (pathname === "/" || pathname === "/login") {
      const token = request.cookies.get("session")?.value;
      if (token) {
        const session = await verifyToken(token);
        if (session) {
          return NextResponse.redirect(new URL(dashboardPath(session.rol), request.url));
        }
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return loginRedirect(request, esRutaTecnico);
  }

  const session = await verifyToken(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    return loginRedirect(request, esRutaTecnico);
  }

  if (esRutaTecnico && session.rol !== "TECNICO") {
    return loginRedirect(request, true);
  }
  if (pathname.startsWith("/supervisor") && !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/reportes") && !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/gerencia") && session.rol !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
