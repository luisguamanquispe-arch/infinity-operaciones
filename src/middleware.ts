import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const publicPaths = ["/login", "/manifest.json", "/api/setup/seed", "/api/health"];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifyToken(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/tecnico") && session.rol !== "TECNICO") {
    return NextResponse.redirect(new URL("/login", request.url));
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
