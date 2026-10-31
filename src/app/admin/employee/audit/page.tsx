import { redirect } from "next/navigation";

export const metadata = {
  title: "Security Audit | IQ Trousers Admin",
};

export default function SecurityAuditPage() {
  redirect("/admin/employee/security?tab=audit");
}
