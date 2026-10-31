import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@arrakis/contracts"],
  images: { unoptimized: true },
};

export default nextConfig;
