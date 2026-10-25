import { prisma } from "@/lib/prisma";
import RegisteredUsersManager from "./RegisteredUsersManager";

export const metadata = {
  title: "Registered Users | IQ Trousers Admin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsersPage() {
  let users: any[] = [];
  try {
    users = await prisma.ecommerceUser.findMany({
      where: {
        role: "USER",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
        orders: {
          select: {
            total: true,
            status: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to query users in AdminUsersPage:", error);
    users = [];
  }

  const serialized = users.map((u: any) => {
    const totalSpent = (u.orders || [])
      .filter((o: any) => o.status !== "CANCELLED")
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || null,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      ordersCount: u._count.orders,
      reviewsCount: u._count.reviews,
      totalSpent,
    };
  });

  return <RegisteredUsersManager initialUsers={serialized} />;
}
