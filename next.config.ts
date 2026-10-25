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
  async redirects() {
    return [
      {
        source: "/admin/orders/:path*",
        destination: "/admin/employee/orders/:path*",
        permanent: false,
      },
      {
        source: "/admin/orders",
        destination: "/admin/employee/orders",
        permanent: false,
      },
      {
        source: "/admin/products/:path*",
        destination: "/admin/employee/products/:path*",
        permanent: false,
      },
      {
        source: "/admin/products",
        destination: "/admin/employee/products",
        permanent: false,
      },
      {
        source: "/admin/customers/:path*",
        destination: "/admin/employee/customers/:path*",
        permanent: false,
      },
      {
        source: "/admin/customers",
        destination: "/admin/employee/customers",
        permanent: false,
      },
      {
        source: "/admin/employees/:path*",
        destination: "/admin/employee/employees/:path*",
        permanent: false,
      },
      {
        source: "/admin/employees",
        destination: "/admin/employee/employees",
        permanent: false,
      },
      {
        source: "/admin/categories",
        destination: "/admin/employee/categories",
        permanent: false,
      },
      {
        source: "/admin/sales",
        destination: "/admin/employee/sales",
        permanent: false,
      },
      {
        source: "/admin/outstanding",
        destination: "/admin/employee/outstanding",
        permanent: false,
      },
      {
        source: "/admin/ledger",
        destination: "/admin/employee/ledger",
        permanent: false,
      },
      {
        source: "/admin/returns",
        destination: "/admin/employee/returns",
        permanent: false,
      },
      {
        source: "/admin/invoices",
        destination: "/admin/employee/invoices",
        permanent: false,
      },
      {
        source: "/admin/bills",
        destination: "/admin/employee/bills",
        permanent: false,
      },
      {
        source: "/admin/profit",
        destination: "/admin/employee/profit",
        permanent: false,
      },
      {
        source: "/admin/reports",
        destination: "/admin/employee/reports",
        permanent: false,
      },
      {
        source: "/admin/invoice-settings",
        destination: "/admin/employee/invoice-settings",
        permanent: false,
      },
      {
        source: "/admin/whatsapp",
        destination: "/admin/employee/whatsapp",
        permanent: false,
      },
      {
        source: "/admin/audit",
        destination: "/admin/employee/audit",
        permanent: false,
      },
      {
        source: "/admin/profile",
        destination: "/admin/employee/profile",
        permanent: false,
      },
      {
        source: "/admin/visited-customers",
        destination: "/admin/employee/visited-customers",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
