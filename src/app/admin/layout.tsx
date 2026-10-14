import { ToastProvider } from "@/components/ui/Toast";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import AdminClientLayout from "@/components/admin/AdminClientLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <AdminAuthGuard>
        <AdminClientLayout>{children}</AdminClientLayout>
      </AdminAuthGuard>
    </ToastProvider>
  );
}
