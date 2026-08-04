import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers land in Story 8.4 (NFR13, NFR16); this file exists now so
  // there is somewhere for them to go.
  reactStrictMode: true,
};

export default nextConfig;
