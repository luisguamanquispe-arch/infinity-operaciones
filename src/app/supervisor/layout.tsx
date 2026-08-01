import { DeployVersionBanner } from "@/components/DeployVersionBanner";
import { SupervisorQuickNav } from "@/components/ModuleQuickNav";
import { GitShaBadge } from "@/components/GitShaBadge";
import { getSession } from "@/lib/auth";

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const rol =
    session?.rol === "ADMIN" || session?.rol === "SUPERVISOR"
      ? session.rol
      : "SUPERVISOR";

  return (
    <>
      <DeployVersionBanner />
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <SupervisorQuickNav rol={rol} />
      </div>
      {children}
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </>
  );
}
