import { DeployVersionBanner, SupervisorQuickNav } from "@/components/DeployVersionBanner";
import { GitShaBadge } from "@/components/GitShaBadge";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeployVersionBanner />
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <SupervisorQuickNav />
      </div>
      {children}
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </>
  );
}
