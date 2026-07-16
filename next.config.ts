import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for a multi-photo report even after
      // client-side compression (up to MAX_IMAGES photos in actions.ts).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
