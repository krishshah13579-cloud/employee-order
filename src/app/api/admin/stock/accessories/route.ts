import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, getAdminSession, getEmployeeSession } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};
    if (category && category !== "All") {
      where.category = category;
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { category: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const items = await prisma.accessoryItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const totalItems = items.length;
    const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
    const lowStockCount = items.filter((it) => it.quantity <= it.minAlertQty).length;
    const totalValuation = items.reduce((acc, it) => acc + Math.round(it.quantity * it.costPerUnit), 0);

    return NextResponse.json({
      items,
      metrics: {
        totalItems,
        totalQuantity,
        lowStockCount,
        totalValuation,
      },
    });
  } catch (err: any) {
    console.error("Error fetching accessories:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);
    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Permission Denied: Stock update access required." }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, quantity, unit, minAlertQty, costPerUnit, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }

    const created = await prisma.accessoryItem.create({
      data: {
        name: name.trim(),
        category: category || "Other",
        quantity: Math.max(0, parseInt(String(quantity), 10) || 0),
        unit: unit || "Pcs",
        minAlertQty: Math.max(0, parseInt(String(minAlertQty), 10) || 100),
        costPerUnit: Math.max(0, parseFloat(String(costPerUnit)) || 0),
        notes: notes ? String(notes).trim() : null,
      },
    });

    return NextResponse.json({ success: true, item: created });
  } catch (err: any) {
    console.error("Error creating accessory item:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);
    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Permission Denied: Stock update access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, category, quantity, adjustQty, unit, minAlertQty, costPerUnit, notes } = body;

    const itemId = parseInt(String(id), 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const existing = await prisma.accessoryItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (category !== undefined) data.category = String(category).trim();
    if (unit !== undefined) data.unit = String(unit).trim();
    if (minAlertQty !== undefined) data.minAlertQty = Math.max(0, parseInt(String(minAlertQty), 10) || 0);
    if (costPerUnit !== undefined) data.costPerUnit = Math.max(0, parseFloat(String(costPerUnit)) || 0);
    if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;

    if (quantity !== undefined) {
      data.quantity = Math.max(0, parseInt(String(quantity), 10) || 0);
    } else if (adjustQty !== undefined) {
      const delta = parseInt(String(adjustQty), 10) || 0;
      data.quantity = Math.max(0, existing.quantity + delta);
    }

    const updated = await prisma.accessoryItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("Error updating accessory item:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.authorized) return admin.errorResponse!;

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "", 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    await prisma.accessoryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
