import { redirect } from "next/navigation";

export const metadata = {
  title: "WhatsApp Gateway | IQ Trousers Admin",
};

export default function AdminWhatsAppPage() {
  redirect("/admin/employee/security?tab=whatsapp");
}
