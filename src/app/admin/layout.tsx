import type { Metadata } from "next";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import AdminClientLayout from "@/components/admin/AdminClientLayout";

export const metadata: Metadata = {
  title: "OBEXA ADMIN — Control Center",
  applicationName: "OBEXA ADMIN",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OBEXA ADMIN",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      <AdminClientLayout>{children}</AdminClientLayout>
    </AdminAuthGuard>
  );
}
