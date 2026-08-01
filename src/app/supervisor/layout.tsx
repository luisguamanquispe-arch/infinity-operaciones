import { DeployVersionBanner } from "@/components/DeployVersionBanner";
import { GitShaBadge } from "@/components/GitShaBadge";

/** Layout operaciones: banner de versión + badge. La nav de módulos va en AppHeader. */
export default function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DeployVersionBanner />
      {children}
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </>
  );
}
