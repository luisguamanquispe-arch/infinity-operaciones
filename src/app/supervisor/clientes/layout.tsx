import { DeployVersionBanner } from "@/components/DeployVersionBanner";

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeployVersionBanner />
      {children}
    </>
  );
}
