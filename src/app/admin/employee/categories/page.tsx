import { redirect } from "next/navigation";

export const metadata = {
  title: "Categories Management | IQ Trousers Admin",
};

export default function AdminCategoriesPage() {
  redirect("/admin/employee/products?tab=categories");
}
