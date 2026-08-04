import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid "inferred workspace root" when multiple lockfiles exist.
    root: __dirname,
  },
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isProd ? "/Cancer-registry" : "",
};

export default nextConfig;
