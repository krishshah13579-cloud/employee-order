import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/admin/order/:id*",
        destination: "/admin/orders/:id*",
      },
      {
        source: "/order/:id*",
        destination: "/orders/:id*",
      },
    ];
  },
};

export default nextConfig;
