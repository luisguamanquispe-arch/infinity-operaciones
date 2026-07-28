import type { Metadata, Viewport } from "next";
import { CapacitorSplashGate } from "@/components/CapacitorSplashGate";

export const metadata: Metadata = {
  title: "LGB Técnicos",
  description: "App de campo para técnicos ISP — LGB Sistemas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LGB Técnicos",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1e40af",
};

export default function TecnicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <CapacitorSplashGate />
      {children}
    </div>
  );
}
