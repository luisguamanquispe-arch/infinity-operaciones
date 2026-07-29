import Image from "next/image";

const LOGO_SRC = "/brand/logo-infinity.png";

export type BrandLogoVariant = "hero" | "header" | "compact";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
};

/**
 * Logo Infinity Internet — proporciones naturales (object-contain).
 * - hero: login / pantallas de marca (fondo claro bajo el logo)
 * - header: barra superior compacta
 * - compact: marca pequeña en chips / nav
 */
export function BrandLogo({
  variant = "hero",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const sizes =
    variant === "hero"
      ? { width: 220, height: 220, imgClass: "w-40 sm:w-48 h-auto" }
      : variant === "header"
        ? { width: 120, height: 120, imgClass: "h-9 w-auto sm:h-10" }
        : { width: 72, height: 72, imgClass: "h-8 w-auto" };

  const frame =
    variant === "hero"
      ? "rounded-2xl bg-white p-4 sm:p-5 shadow-lg shadow-black/10"
      : variant === "header"
        ? "rounded-lg bg-white/95 px-2 py-1"
        : "rounded-md bg-white/95 px-1.5 py-0.5";

  return (
    <div className={`inline-flex items-center justify-center ${frame} ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="Infinity Internet"
        width={sizes.width}
        height={sizes.height}
        className={`${sizes.imgClass} object-contain`}
        priority={priority}
      />
    </div>
  );
}
