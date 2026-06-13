import type { NextConfig } from "next";

/** En Render free (512 MB) el build standalone provoca OOM; se desactiva con RENDER_LOW_MEMORY=1 */
const lowMemory = process.env.RENDER_LOW_MEMORY === "1";

const nextConfig: NextConfig = {
  ...(lowMemory ? {} : { output: "standalone" }),
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    optimizePackageImports: ["lucide-react", "date-fns"],
    serverActions: {
      bodySizeLimit: "4mb",
    },
    middlewareClientMaxBodySize: "4mb",
  },
};

export default nextConfig;
