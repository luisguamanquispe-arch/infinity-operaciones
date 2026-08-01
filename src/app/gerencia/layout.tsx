import { DeployVersionBanner } from "@/components/DeployVersionBanner";

/** Layout gerencia: banner de deploy. Módulos en AppHeader. */
export default function GerenciaLayout({
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
