import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    middlewareClientMaxBodySize: "4mb",
  },
};

export default nextConfig;