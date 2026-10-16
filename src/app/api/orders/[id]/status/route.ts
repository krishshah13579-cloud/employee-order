import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ORDER_STATUSES, OrderStatus } from "@/lib/types";
import { restoreSetsToStock, deductSetsFromStock } from "@/lib/stock";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = !admin ? await getEmployeeSession(request) : null;

    if (!admin && !employee) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to update order status." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values are: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "Confirmed" && !admin) {
      return NextResponse.json(
        { error: "Permission Denied: Only Admin or Super Admin can confirm orders." },
        { status: 403 }
      );
    }

    // Fetch existing order with items to handle stock adjustment
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. If cancelling order, restore stock sets back to inventory
    if (status === "Cancelled" && existingOrder.status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const restored = restoreSetsToStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: restored },
                });
              }
            }
          } catch (e) {
            console.error("Error restoring stock sets on cancellation:", e);
          }
        }
      }
    }

    // 2. If un-cancelling order, re-deduct stock
    if (existingOrder.status === "Cancelled" && status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const deducted = deductSetsFromStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: deducted },
                });
              }
            }
          } catch (e) {
            console.error("Error re-deducting stock sets:", e);
          }
        }
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        customer: true,
        items: true,
      },
    });

    // Automated WhatsApp trigger on status change to "Confirmed" or "Ready"
    const customerPhone = updatedOrder.customerPhone || updatedOrder.customer?.phoneNumber;
    if (customerPhone && (status === "Confirmed" || status === "Ready")) {
      try {
        const origin =
          request.headers.get("origin") ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://krish-clothing.vercel.app";

        const {
          generateOrderWhatsAppMessage,
          generateTaxInvoiceWhatsAppMessage,
          dispatchAutomatedWhatsApp,
        } = await import("@/lib/whatsapp");

        const isReady = status === "Ready";
        const pdfDocType = isReady ? "tax_invoice" : "order_form";
        const pdfUrl = `${origin.replace(/\/$/, "")}/api/orders/${updatedOrder.id}/pdf?type=${pdfDocType}`;
        const docNo = (isReady && updatedOrder.taxInvoiceNumber ? updatedOrder.taxInvoiceNumber : updatedOrder.orderNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
        const pdfFilename = `${isReady ? "Tax_Invoice" : "Order_Form"}_${docNo}.pdf`;

        const messageText = isReady
          ? generateTaxInvoiceWhatsAppMessage(updatedOrder as any, origin)
          : generateOrderWhatsAppMessage(updatedOrder as any, origin);

        // Run automated dispatch in background
        dispatchAutomatedWhatsApp(customerPhone, messageText, {
          pdfUrl,
          filename: pdfFilename,
        }).catch((err) => console.error("Auto WhatsApp status dispatch error:", err));
      } catch (waErr) {
        console.error("Auto WhatsApp notification error:", waErr);
      }
    }

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Failed to update order status: " + error.message }, { status: 500 });
  }
}
