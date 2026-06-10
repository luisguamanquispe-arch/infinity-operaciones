import { redirect } from "next/navigation";
import { getSession, dashboardPath } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(dashboardPath(session.rol));
  redirect("/login");
}
