import type { NextConfig } from "next";
import withPWA from "next-pwa";

const baseConfig: NextConfig = {
  output: "export",
  distDir: ".next",
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  devIndicators: false,
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // Disable PWA in development
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
  ],
});

const nextConfig =
  process.env.NODE_ENV === "development"
    ? baseConfig
    : pwaConfig(baseConfig as any);

export default nextConfig;
