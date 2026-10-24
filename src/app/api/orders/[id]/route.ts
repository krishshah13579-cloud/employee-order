import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, requireAdmin, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { calculateOrderedColorSetsPieces } from "@/lib/stock";
import { createOrUpdateSalesInvoiceFromOrder } from "@/lib/sales";
import { getNextTaxInvoiceNumber } from "@/lib/order-numbers";
import { sanitizePositiveInt } from "@/lib/navigation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(_request);
    const employee = await getEmployeeSession(_request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized. Please log in to view this order." }, { status: 401 });
    }

    const { id } = await params;
    const orderId = sanitizePositiveInt(id);

    if (!orderId) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Role-based Order Isolation (IDOR Defense):
    // If not Admin and not Krish Shah (Team Leader), verify order belongs to this employee
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const empName = (employee.name || "").trim().toLowerCase();
      const placedBy = (order.placedBy || "").trim().toLowerCase();
      const custAllocatedEmpId = order.customer?.allocatedEmployeeId;
      const custAllocatedEmpName = (order.customer?.allocatedEmployeeName || "").trim().toLowerCase();

      const isMyOrder = placedBy === empName;
      const isMyAllocatedCustomer =
        (custAllocatedEmpId && custAllocatedEmpId === employee.id) ||
        (custAllocatedEmpName && custAllocatedEmpName === empName);

      if (!isMyOrder && !isMyAllocatedCustomer) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to view this order. Customer/order belongs to another employee." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order: " + error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized. Please log in to edit this order." }, { status: 401 });
    }

    const { id } = await params;
    const orderId = sanitizePositiveInt(id);

    if (!orderId) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah) {
      if (!employee) {
        return NextResponse.json({ error: "Unauthorized. Please log in to edit this order." }, { status: 401 });
      }

      // Check if employee has Admin Approval to edit order forms
      if (!employee.canEditOrders) {
        return NextResponse.json(
          {
            error: "Permission Denied: Order form editing is locked for your account. Please ask Administrator to approve Order Form Editing access from the Admin Panel.",
          },
          { status: 403 }
        );
      }

      // IDOR Defense: verify order belongs to or is allocated to this employee
      const empName = (employee.name || "").trim().toLowerCase();
      const placedBy = (existingOrder.placedBy || "").trim().toLowerCase();
      const custAllocatedEmpId = existingOrder.customer?.allocatedEmployeeId;
      const custAllocatedEmpName = (existingOrder.customer?.allocatedEmployeeName || "").trim().toLowerCase();

      const isMyOrder = placedBy === empName;
      const isMyAllocatedCustomer =
        (custAllocatedEmpId && custAllocatedEmpId === employee.id) ||
        (custAllocatedEmpName && custAllocatedEmpName === empName);

      if (!isMyOrder && !isMyAllocatedCustomer) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to edit this order. Customer/order belongs to another employee." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      orderNumber,
      customerId,
      placedBy,
      notes,
      items,
      orderDate,
      status,
      taxInvoiceNumber,
      taxInvoiceDate,
      taxInvoiceItems,
      templateOverrides,
    } = body;

    // Check if status is reverting to Pending or already Pending
    const willBePending = body.status === "Pending" || (body.status === undefined && existingOrder.status === "Pending");

    if (existingOrder.status !== "Pending" && body.status === "Pending") {
      if (!admin && !isTLKrishShah) {
        return NextResponse.json(
          { error: "Permission Denied: Only Admin can revert a confirmed order back to Pending status." },
          { status: 403 }
        );
      }
    }

    if (!admin && body.status && body.status !== "Pending" && existingOrder.status === "Pending") {
      return NextResponse.json(
        { error: "Permission Denied: Only Admin can confirm or advance orders beyond Pending status." },
        { status: 403 }
      );
    }

    const isAlreadyConfirmed =
      !willBePending && (
        existingOrder.status === "Confirmed" ||
        existingOrder.status === "In Production" ||
        existingOrder.status === "Ready" ||
        existingOrder.status === "Dispatched" ||
        existingOrder.status === "Delivered"
      );

    // Only Tax Invoice modal adjustments (taxInvoiceNumber, taxInvoiceDate, taxInvoiceItems, templateOverrides) are permitted on confirmed orders
    const isTaxInvoiceOnlyUpdate =
      body.taxInvoiceNumber !== undefined &&
      body.taxInvoiceItems !== undefined &&
      !body.items;

    if (!admin && !isTLKrishShah && isAlreadyConfirmed && !isTaxInvoiceOnlyUpdate && (body.items !== undefined || body.orderNumber !== undefined || body.customerId !== undefined)) {
      return NextResponse.json(
        {
          error: `Order #${existingOrder.orderNumber} is currently ${existingOrder.status} and locked. Only Pending orders can be edited by staff.`,
        },
        { status: 403 }
      );
    }

    if (status === "Confirmed" && existingOrder.status !== "Confirmed") {
      const admin = await getAdminSession(request);
      if (!admin) {
        return NextResponse.json(
          { error: "Permission Denied: Only Admin or Super Admin can confirm orders." },
          { status: 403 }
        );
      }
    }

    let targetCustomerId = existingOrder.customerId;
    let targetCustomerName = existingOrder.customerName;
    let targetCustomerGstPan = existingOrder.customerGstPan;
    let targetCustomerPhone = existingOrder.customerPhone;
    let targetCustomerAddress = existingOrder.customerAddress;

    let targetOrderNumber = existingOrder.orderNumber;
    if (orderNumber && String(orderNumber).trim()) {
      const cleanNum = String(orderNumber).trim();
      if (cleanNum !== existingOrder.orderNumber) {
        const conflict = await prisma.order.findUnique({ where: { orderNumber: cleanNum } });
        if (conflict && conflict.id !== orderId) {
          return NextResponse.json(
            { error: `Order Number "${cleanNum}" is already used by another order.` },
            { status: 400 }
          );
        }
        targetOrderNumber = cleanNum;
      }
    }

    if (customerId) {
      const cust = await prisma.customer.findUnique({
        where: { id: parseInt(customerId, 10) },
      });
      if (cust) {
        targetCustomerId = cust.id;
        targetCustomerName = cust.shopName;
        targetCustomerGstPan = cust.gstPanNo;
        targetCustomerPhone = cust.phoneNumber;
        targetCustomerAddress = cust.address;
      }
    }

    let orderSubtotal = 0;
    let orderTotalPcs = 0;
    let orderTotalSets = 0;
    const validatedItems: any[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const rawPid = parseInt(String(it.productId), 10);
        let product = !isNaN(rawPid) && rawPid > 0
          ? await prisma.product.findUnique({
              where: { id: rawPid },
            })
          : null;

        // If product not found by id, try find by name
        if (!product && it.productName) {
          product = await prisma.product.findFirst({
            where: { name: it.productName },
          });
        }

        // Guaranteed valid foreign key product ID
        let targetPid = product ? product.id : (!isNaN(rawPid) && rawPid > 0 ? rawPid : 0);
        if (targetPid <= 0) {
          const firstP = await prisma.product.findFirst({ select: { id: true } });
          targetPid = firstP?.id || 1;
        }

        const pcsPerSet = parseInt(String(it.pcsPerSet), 10) || product?.pcsPerSet || 5;

        let colorSetsArray: any[] = [];
        if (Array.isArray(it.colorSets)) {
          colorSetsArray = it.colorSets;
        } else if (typeof it.colorSets === "string") {
          try {
            const p = JSON.parse(it.colorSets);
            if (Array.isArray(p)) colorSetsArray = p;
          } catch {
            colorSetsArray = [];
          }
        }

        let itemTotalSets = colorSetsArray.reduce(
          (sum: number, cs: any) => sum + (parseInt(String(cs.sets), 10) || 0),
          0
        );

        const hasMixPcs = it.mixPcs > 0 || (it.colorMixPcs && typeof it.colorMixPcs === "object" && Object.keys(it.colorMixPcs).length > 0);

        if (itemTotalSets === 0) {
          if (it.totalSets !== undefined && it.totalSets !== null && !isNaN(parseInt(String(it.totalSets), 10))) {
            itemTotalSets = Math.max(0, parseInt(String(it.totalSets), 10));
          } else if (!hasMixPcs && it.quantity && parseInt(String(it.quantity), 10) > 0) {
            itemTotalSets = Math.max(1, Math.round(parseInt(String(it.quantity), 10) / pcsPerSet));
          } else {
            itemTotalSets = 0;
          }

          if (itemTotalSets > 0 && colorSetsArray.length === 0) {
            colorSetsArray = [{ color: it.color || "Standard", sets: itemTotalSets }];
          }
        }

        let itemTotalPcs = 0;
        for (const cs of colorSetsArray) {
          const requested = parseInt(String(cs.sets), 10) || 0;
          if (requested <= 0) continue;
          const pcsCalc = calculateOrderedColorSetsPieces(
            product ? product.setsColorwise : null,
            cs.color,
            requested,
            pcsPerSet
          );
          itemTotalPcs += pcsCalc.totalPcs;
        }

        const itemMixPcs = parseInt(String(it.mixPcs), 10) || 0;
        itemTotalPcs += itemMixPcs;

        if (itemTotalPcs === 0) {
          itemTotalPcs = Number(it.totalPcs) || (itemTotalSets * pcsPerSet) + itemMixPcs;
        }

        const unitPrice = parseFloat(String(it.unitPrice)) || product?.price || 0;
        const itemSubtotal = itemTotalPcs * unitPrice;

        orderSubtotal += itemSubtotal;
        orderTotalPcs += itemTotalPcs;
        orderTotalSets += itemTotalSets;

        validatedItems.push({
          orderId,
          productId: targetPid,
          productName: product ? product.name : (it.productName || "Garment"),
          colorSets: JSON.stringify(colorSetsArray),
          sizeRatio: it.sizeRatio || product?.sizesRatio || "Standard",
          sizesList: it.sizesList || product?.sizesList || "Standard",
          pcsPerSet,
          totalSets: itemTotalSets,
          totalPcs: itemTotalPcs,
          unitPrice,
          itemSubtotal,
          notes: it.notes || null,
        });
      }
    }

    // GST calculation: 0% if Without GST (Wholesale or Retailer), else 5%
    const targetBusinessType = (body.businessType || existingOrder.businessType || "RETAILER").trim().toUpperCase();
    const isWithoutGst =
      targetBusinessType === "WHOLESALER WITHOUT GST" ||
      targetBusinessType === "WHOLESALE WITHOUT GST" ||
      targetBusinessType === "RETAILER WITHOUT GST" ||
      targetBusinessType === "RETAILER (WITHOUT GST)" ||
      targetBusinessType.includes("WITHOUT GST") ||
      targetBusinessType.includes("NO GST") ||
      body.gstRate === 0;
    const gstRate = isWithoutGst ? 0 : 5.0;
    const gstAmount = isWithoutGst ? 0 : Math.round(orderSubtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round(orderSubtotal + gstAmount);

    let effectiveTaxInvoiceNumber =
      taxInvoiceNumber !== undefined
        ? taxInvoiceNumber
          ? String(taxInvoiceNumber).trim().toUpperCase()
          : null
        : existingOrder.taxInvoiceNumber;

    let effectiveTaxInvoiceDate =
      taxInvoiceDate !== undefined
        ? taxInvoiceDate
          ? new Date(taxInvoiceDate)
          : null
        : existingOrder.taxInvoiceDate;

    const nextStatus = status || existingOrder.status;
    if (nextStatus === "Confirmed" && (!effectiveTaxInvoiceNumber || !effectiveTaxInvoiceNumber.trim())) {
      effectiveTaxInvoiceNumber = await getNextTaxInvoiceNumber();
      effectiveTaxInvoiceDate = effectiveTaxInvoiceDate || new Date();
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (validatedItems.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({ data: validatedItems });
      }

      return await tx.order.update({
        where: { id: orderId },
        data: {
          orderNumber: targetOrderNumber,
          customerId: targetCustomerId,
          customerName: targetCustomerName,
          customerGstPan: targetCustomerGstPan,
          customerPhone: targetCustomerPhone,
          customerAddress: targetCustomerAddress,
          orderDate: orderDate ? new Date(orderDate) : existingOrder.orderDate,
          status: status || existingOrder.status,
          subtotal: validatedItems.length > 0 ? orderSubtotal : existingOrder.subtotal,
          gstRate,
          gstAmount: validatedItems.length > 0 ? gstAmount : existingOrder.gstAmount,
          grandTotal: validatedItems.length > 0 ? grandTotal : existingOrder.grandTotal,
          totalPcs: validatedItems.length > 0 ? orderTotalPcs : existingOrder.totalPcs,
          totalSets: validatedItems.length > 0 ? orderTotalSets : existingOrder.totalSets,
          placedBy: placedBy !== undefined ? placedBy : existingOrder.placedBy,
          notes: notes !== undefined ? notes : existingOrder.notes,
          taxInvoiceNumber: effectiveTaxInvoiceNumber,
          taxInvoiceDate: effectiveTaxInvoiceDate,
          taxInvoiceItems:
            taxInvoiceItems !== undefined
              ? typeof taxInvoiceItems === "string"
                ? taxInvoiceItems
                : JSON.stringify(taxInvoiceItems)
              : validatedItems.length > 0
              ? null
              : existingOrder.taxInvoiceItems,
          templateOverrides:
            templateOverrides !== undefined
              ? typeof templateOverrides === "string"
                ? templateOverrides
                : JSON.stringify(templateOverrides)
              : (existingOrder as any).templateOverrides,
        },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    // Automatically sync updated confirmed order to Sales Register
    await createOrUpdateSalesInvoiceFromOrder(orderId);

    // Automated WhatsApp trigger on status change or order edit for Confirmed / Ready
    const effectiveStatus = updatedOrder.status;
    const customerPhone = updatedOrder.customerPhone || updatedOrder.customer?.phoneNumber;
    let whatsappPayload: any = null;

    const shouldNotify = Boolean(
      body.notifyCustomer ||
      (status && status !== existingOrder.status) ||
      ((effectiveStatus === "Confirmed" || effectiveStatus === "Ready") && body.sendWhatsApp !== false)
    );

    if (customerPhone && shouldNotify) {
      try {
        const origin =
          request.headers.get("origin") ||
          request.headers.get("referer")?.replace(/\/admin.*$/, "") ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://krish-clothing.vercel.app";

        const {
          generateOrderStatusUpdateWhatsAppMessage,
          dispatchAutomatedWhatsApp,
          createWhatsAppDirectLink,
          createWhatsAppNativeLink,
        } = await import("@/lib/whatsapp");

        const statusMsgConfig = generateOrderStatusUpdateWhatsAppMessage(
          updatedOrder as any,
          effectiveStatus,
          origin
        );

        const effectivePdfUrl = statusMsgConfig.hasDocument ? statusMsgConfig.pdfUrl : undefined;
        let effectiveFilename = statusMsgConfig.hasDocument ? statusMsgConfig.filename : undefined;
        let pdfBase64: string | undefined = undefined;

        if (statusMsgConfig.hasDocument) {
          try {
            const { generateOrderPdfBuffer } = await import("@/lib/pdf-generator");
            const pdfRes = await generateOrderPdfBuffer(
              orderId,
              statusMsgConfig.pdfType === "tax_invoice" ? "TAX_INVOICE" : "ORDER_FORM"
            );
            pdfBase64 = pdfRes.pdfBuffer.toString("base64");
            effectiveFilename = pdfRes.fileName;
          } catch (pdfErr) {
            console.warn("Could not generate PDF buffer for order update WhatsApp:", pdfErr);
          }
        }

        const autoResult = await dispatchAutomatedWhatsApp(customerPhone, statusMsgConfig.message, {
          pdfUrl: effectivePdfUrl,
          pdfBase64,
          filename: effectiveFilename || "Invoice.pdf",
        }).catch((err) => ({ success: false, method: "ERROR", error: err.message }));

        whatsappPayload = {
          customerPhone,
          message: statusMsgConfig.message,
          pdfUrl: effectivePdfUrl,
          filename: effectiveFilename,
          hasDocument: statusMsgConfig.hasDocument,
          directUrl: createWhatsAppDirectLink(customerPhone, statusMsgConfig.message),
          nativeUrl: createWhatsAppNativeLink(customerPhone, statusMsgConfig.message),
          dispatchedByServer: autoResult.success,
          dispatchMethod: autoResult.method,
        };
      } catch (waErr) {
        console.error("Auto WhatsApp notification error in order update:", waErr);
      }
    }

    return NextResponse.json({
      ...updatedOrder,
      whatsapp: whatsappPayload,
    });
  } catch (error: any) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order: " + error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(_request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Determine whether to restore stock:
    // Support URL param ?restoreStock=true/false
    // Support JSON body { restoreStock: true/false, twoFactorCode: string }
    let restoreStock = true;
    let requestBody: any = {};
    try {
      requestBody = await _request.json();
      if (typeof requestBody.restoreStock === "boolean") {
        restoreStock = requestBody.restoreStock;
      }
    } catch {
      // No JSON body provided
    }

    const url = new URL(_request.url);
    if (url.searchParams.has("restoreStock")) {
      restoreStock = url.searchParams.get("restoreStock") !== "false";
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "Dispatched") {
      return NextResponse.json(
        { error: "Cannot delete dispatched orders. Dispatched orders/invoices cannot be deleted." },
        { status: 400 }
      );
    }

    // 1. Super Admin 2FA Authentication for Generated Invoices
    // "NO ONE CAN DELETE THE INVOICE ONCE GENERATED TO DELETE ONE NEED TO AUTHENTICATE USING THE 2FA OF SUPER ADMIN."
    if (order.taxInvoiceNumber && order.taxInvoiceNumber.trim()) {
      const codeFromReq =
        requestBody.twoFactorCode ||
        _request.headers.get("x-admin-2fa-code") ||
        url.searchParams.get("twoFactorCode");

      if (!codeFromReq || String(codeFromReq).trim().length < 4) {
        return NextResponse.json(
          {
            error:
              "Invoice has been generated. Deletion is locked! Super Admin 2FA authentication code is required to delete this invoice.",
          },
          { status: 403 }
        );
      }

      const cleanCode = String(codeFromReq).trim();
      const admin = await prisma.adminAccount.findFirst();

      if (!admin) {
        return NextResponse.json(
          { error: "Super Admin account is not configured." },
          { status: 500 }
        );
      }

      const isOtpMatch =
        admin.lastOtp &&
        admin.lastOtp === cleanCode &&
        (!admin.otpExpiresAt || new Date() <= admin.otpExpiresAt);
      const isSecretMatch = admin.twoFactorSecret && admin.twoFactorSecret === cleanCode;

      if (!isOtpMatch && !isSecretMatch) {
        return NextResponse.json(
          { error: "Invalid or expired Super Admin 2FA security code. Invoice deletion rejected." },
          { status: 401 }
        );
      }

      // Clear one-time OTP so it cannot be reused
      if (admin.lastOtp) {
        await prisma.adminAccount.update({
          where: { id: admin.id },
          data: { lastOtp: null, otpExpiresAt: null },
        });
      }

      // Delete the corresponding SalesInvoice as authorized by Super Admin 2FA
      try {
        await prisma.salesInvoice.deleteMany({
          where: {
            OR: [
              { orderId: order.id },
              { invoiceNumber: order.taxInvoiceNumber },
            ],
          },
        });
      } catch (invDelErr) {
        console.error("Error deleting sales invoice upon 2FA authorization:", invDelErr);
      }
    }

    // 2. If restoreStock is requested, restore the stock sets back to product setsColorwise
    if (restoreStock && order.items && order.items.length > 0) {
      const productItemsMap = new Map<number, { color: string; sets: number; ratio?: string }[]>();

      for (const item of order.items) {
        if (!productItemsMap.has(item.productId)) {
          productItemsMap.set(item.productId, []);
        }

        let colorSetsList: { color: string; sets: number }[] = [];
        try {
          if (typeof item.colorSets === "string") {
            colorSetsList = JSON.parse(item.colorSets);
          } else if (Array.isArray(item.colorSets)) {
            colorSetsList = item.colorSets;
          }
        } catch {
          colorSetsList = [];
        }

        if (Array.isArray(colorSetsList) && colorSetsList.length > 0) {
          for (const cs of colorSetsList) {
            const numSets = parseInt(String(cs.sets), 10) || 0;
            if (numSets > 0 && cs.color) {
              productItemsMap.get(item.productId)!.push({
                color: cs.color,
                sets: numSets,
                ratio: item.sizeRatio,
              });
            }
          }
        } else if (item.totalSets > 0) {
          productItemsMap.get(item.productId)!.push({
            color: "Standard",
            sets: item.totalSets,
            ratio: item.sizeRatio,
          });
        }
      }

      // Perform stock restoration for each affected product
      for (const [productId, returnedSets] of productItemsMap.entries()) {
        if (returnedSets.length === 0) continue;
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, setsColorwise: true },
        });

        if (product && product.setsColorwise && product.setsColorwise.trim() !== "") {
          const { restoreSetsToStock } = await import("@/lib/stock");
          const updatedStock = restoreSetsToStock(product.setsColorwise, returnedSets);
          await prisma.product.update({
            where: { id: productId },
            data: { setsColorwise: updatedStock },
          });
        }
      }
    }

    // 3. Delete the order (Prisma cascades deletion to OrderItem)
    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      message: restoreStock
        ? "Order deleted and stock added back to inventory successfully"
        : "Order form deleted successfully (stock unchanged)",
      id: orderId,
      stockRestored: restoreStock,
    });
  } catch (error: any) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order: " + error.message }, { status: 500 });
  }
}
