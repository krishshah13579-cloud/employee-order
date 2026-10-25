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
        source: "/admin",
        destination: "/employee",
      },
      {
        source: "/admin/:path((?!login).*)",
        destination: "/employee/:path*",
      },
      {
        source: "/employee/order/:id*",
        destination: "/employee/orders/:id*",
      },
      {
        source: "/order/:id*",
        destination: "/orders/:id*",
      },
    ];
  },
};

export default nextConfig;
