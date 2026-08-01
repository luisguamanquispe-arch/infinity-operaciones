import { DeployVersionBanner } from "@/components/DeployVersionBanner";

/** Layout reportes de campo. Módulos en AppHeader. */
export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DeployVersionBanner />
      {children}
    </>
  );
}
