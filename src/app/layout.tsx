import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/components/providers/CartProvider";
import StoreLayoutShell from "@/components/layout/StoreLayoutShell";
import { EmployeeProvider } from "@/components/providers/EmployeeProvider";

export const metadata: Metadata = {
  title: "IQ TROUSERS — Premium Garment Manufacturers & Wholesalers",
  description: "IQ TROUSERS B2B Wholesale Order Collection & Factory Management System",
  icons: {
    icon: "/images/iq-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-white text-gray-900 antialiased">
        <ToastProvider>
          <EmployeeProvider>
            <CartProvider>
              <StoreLayoutShell>{children}</StoreLayoutShell>
            </CartProvider>
          </EmployeeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
