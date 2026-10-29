import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // sharp memakai binari native: jangan di-bundle (§6.3.1).
  serverExternalPackages: ["sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
