import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during build to avoid conflicting configurations
    ignoreDuringBuilds: true,
  },
  output: "standalone",
};

export default nextConfig;
