import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid "inferred workspace root" when multiple lockfiles exist.
    root: __dirname,
  },
};

export default nextConfig;
