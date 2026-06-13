import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
    serverActions: {
      bodySizeLimit: "4mb",
    },
    middlewareClientMaxBodySize: "4mb",
  },
};

export default nextConfig;