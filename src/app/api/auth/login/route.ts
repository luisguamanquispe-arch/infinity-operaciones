import { NextResponse } from "next/server";
import { authenticateOperacionesLogin, authLoginJson } from "@/lib/auth-login";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await authenticateOperacionesLogin(
      {
        email: body.email,
        password: body.password,
        appTecnico: body.app === "tecnico" || body.appTecnico === true,
      },
      request
    );
    return authLoginJson(result);
  } catch (err) {
    console.error("[Login]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
