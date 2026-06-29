import { HomeEntry } from "@/components/splash/HomeEntry";

/**
 * Entrada de la aplicación web.
 * La primera visita muestra el video de bienvenida; luego redirige al login.
 * Usuarios con sesión activa son enviados al panel por el middleware.
 */
export default function Home() {
  return <HomeEntry />;
}
