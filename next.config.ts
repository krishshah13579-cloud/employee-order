import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/admin/employee/order/:id*",
        destination: "/admin/employee/orders/:id*",
      },
      {
        source: "/order/:id*",
        destination: "/orders/:id*",
      },
    ];
  },
};

export default nextConfig;
