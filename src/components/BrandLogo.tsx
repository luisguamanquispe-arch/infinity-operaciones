const LOGO_SRC = "/brand/logo-infinity.png";

export type BrandLogoVariant = "hero" | "header" | "compact";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  /** @deprecated next/image no requerido; se mantiene por compatibilidad */
  priority?: boolean;
};

/**
 * Logo Infinity Internet — proporciones naturales (object-contain).
 * Usa <img> nativo para que cargue siempre desde /public (supervisor, gerencia, login).
 */
export function BrandLogo({ variant = "hero", className = "" }: BrandLogoProps) {
  if (variant === "hero") {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-2xl bg-white p-4 sm:p-5 shadow-lg shadow-black/10 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt="Infinity Internet"
          width={192}
          height={192}
          className="w-40 sm:w-48 h-auto object-contain"
          decoding="async"
        />
      </div>
    );
  }

  if (variant === "header") {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm shrink-0 ${className}`}
        title="Infinity Internet"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC}
          alt="Infinity Internet"
          width={96}
          height={96}
          className="h-11 w-auto max-w-[7.5rem] object-contain object-center"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg bg-white px-1.5 py-1 shadow-sm shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="Infinity Internet"
        width={64}
        height={64}
        className="h-8 w-auto max-w-[4.5rem] object-contain"
        decoding="async"
      />
    </div>
  );
}
