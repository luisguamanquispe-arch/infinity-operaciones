import { redirect } from "next/navigation";

export default async function RedirectDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/help-desk/${id}`);
}
