import type { Metadata, Viewport } from "next";
import { MantenerServidor } from "@/components/MantenerServidor";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinity Operaciones",
  description: "Dashboard operativo para técnicos ISP — Infinity Internet",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/brand/logo-infinity.png", type: "image/png" }],
    apple: [{ url: "/brand/logo-infinity.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Infinity Ops",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1e40af",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="bg-infinity-800" style={{ backgroundColor: "#1e40af" }}>
      <body className="bg-slate-50">
        <MantenerServidor />
        {children}
      </body>
    </html>
  );
}
