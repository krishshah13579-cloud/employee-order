import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import AdminClientLayout from "@/components/admin/AdminClientLayout";

export default function StockLayout({
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
