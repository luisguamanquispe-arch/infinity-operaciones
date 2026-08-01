import { DeployVersionBanner } from "@/components/DeployVersionBanner";
import { PanelHomeLink } from "@/components/ModuleQuickNav";
import { getSession } from "@/lib/auth";

export default async function HelpDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <>
      <DeployVersionBanner />
      {(session?.rol === "ADMIN" || session?.rol === "SUPERVISOR") && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <PanelHomeLink rol={session.rol} />
        </div>
      )}
      {children}
    </>
  );
}
