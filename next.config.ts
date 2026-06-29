import type { NextConfig } from "next";

/** Render free (512 MB): desactivar standalone en build nativo */
const lowMemory = process.env.RENDER_LOW_MEMORY === "1";

const nextConfig: NextConfig = {
  ...(lowMemory ? {} : { output: "standalone" }),
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@prisma/client", "prisma"],
  async headers() {
    return [
      {
        source: "/intro_infinity.mp4",
        headers: [
          { key: "Content-Type", value: "video/mp4" },
          { key: "Accept-Ranges", value: "bytes" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/prisma/**",
      "./node_modules/.bin/prisma",
      "./node_modules/.bin/prisma*",
    ],
  },
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    optimizePackageImports: ["lucide-react", "date-fns"],
    cpus: 1,
    serverActions: {
      bodySizeLimit: "4mb",
    },
    middlewareClientMaxBodySize: "4mb",
  },
};

export default nextConfig;
