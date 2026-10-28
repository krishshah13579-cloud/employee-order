import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/components/providers/CartProvider";
import StoreLayoutShell from "@/components/layout/StoreLayoutShell";
import { EmployeeProvider } from "@/components/providers/EmployeeProvider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#162082",
};

export const metadata: Metadata = {
  title: "IQ TROUSERS — Premium Garment Manufacturers & Wholesalers",
  description: "IQ TROUSERS B2B Wholesale Order Collection & Factory Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OBEXA ADMIN",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OBEXA ADMIN" />
        <meta name="application-name" content="OBEXA ADMIN" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans bg-white text-gray-900 antialiased min-h-screen">
        <ToastProvider>
          <EmployeeProvider>
            <NotificationProvider>
              <CartProvider>
                <StoreLayoutShell>{children}</StoreLayoutShell>
              </CartProvider>
            </NotificationProvider>
          </EmployeeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
