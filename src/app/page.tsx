import { redirect } from "next/navigation";

/** Entrada directa al login; sesiones activas van al panel vía middleware. */
export default function Home() {
  redirect("/login");
}
