import type { Metadata } from "next";
import { origenPublico } from "@/lib/satisfaccion/reglas";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const origin = origenPublico(process.env.PUBLIC_APP_URL);
  const imagen = "/brand/logo-infinity.png";
  return {
    metadataBase: origin ? new URL(origin) : undefined,
    title: "Encuesta de satisfacción",
    description:
      "Califique de 1 a 5 estrellas el servicio técnico de Infinity Internet. Una estrella es la nota más baja y cinco la más alta.",
    openGraph: {
      title: "Encuesta de satisfacción · Infinity Internet",
      description:
        "Toque las estrellas para calificar el servicio. Una estrella es la nota más baja y cinco la más alta.",
      images: [{ url: imagen, alt: "Infinity Internet" }],
    },
  };
}

export default function EncuestaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
