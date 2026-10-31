import { redirect } from "next/navigation";

export const metadata = {
  title: "Invoice Settings | IQ Trousers Admin",
};

export default function InvoiceSettingsPage() {
  redirect("/admin/employee/reports?tab=invoice-settings");
}
