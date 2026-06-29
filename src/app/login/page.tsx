import { LoginShell } from "./LoginShell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const esAppTecnico = params.app === "tecnico";
  return <LoginShell esAppTecnico={esAppTecnico} />;
}
