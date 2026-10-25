import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import AdminClientLayout from "@/components/admin/AdminClientLayout";

export default function OnlineLayout({
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
