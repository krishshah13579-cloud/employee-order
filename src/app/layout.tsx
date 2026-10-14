import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/Toast";
import { CartProvider } from "@/components/providers/CartProvider";

export const metadata: Metadata = {
  title: "IQ TROUSERS — Premium Garment Manufacturers & Wholesalers",
  description: "IQ TROUSERS B2B Wholesale Order Collection & Factory Management System",
  icons: {
    icon: "/images/iq-logo.jpg",
  },
};

import StoreLayoutShell from "@/components/layout/StoreLayoutShell";
import { EmployeeProvider } from "@/components/providers/EmployeeProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-white text-gray-900 antialiased">
        <EmployeeProvider>
          <CartProvider>
            <StoreLayoutShell>{children}</StoreLayoutShell>
            <Toaster />
          </CartProvider>
        </EmployeeProvider>
      </body>
    </html>
  );
}
