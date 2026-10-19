import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAST_INVOICES_1_TO_39 } from "@/lib/pastInvoicesData";

export async function POST(request: NextRequest) {
  try {
    let importedOrders = 0;
    let importedInvoices = 0;
    let createdCustomers = 0;

    // Cache customer lookups
    const customerMap = new Map<string, any>();

    for (const inv of PAST_INVOICES_1_TO_39) {
      const cleanCustomerName = inv.customerName.trim();
      let customer = customerMap.get(cleanCustomerName.toLowerCase());

      if (!customer) {
        // Find existing customer by shopName
        customer = await prisma.customer.findFirst({
          where: {
            shopName: {
              equals: cleanCustomerName,
            },
          },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              shopName: cleanCustomerName,
              address: inv.customerAddress || inv.city || "Ahmedabad",
              city: inv.city || "Ahmedabad",
              state: inv.state || (inv.isIgst ? "Maharashtra" : "Gujarat"),
              gstPanNo: inv.customerGstPan || "",
              phoneNumber: "",
              businessType: inv.isCashMemo ? "CASH" : "RETAILER",
              creditDays: inv.creditDays || (inv.isCashMemo ? 0 : 45),
            },
          });
          createdCustomers++;
        }
        customerMap.set(cleanCustomerName.toLowerCase(), customer);
      }

      const orderNumber = `GO-HIST-${String(inv.invoiceNumber).padStart(3, "0")}`;

      // Check if Order already exists
      let order = await prisma.order.findFirst({
        where: {
          OR: [
            { taxInvoiceNumber: inv.invoiceNumber },
            { orderNumber },
          ],
        },
      });

      const noteText = [
        inv.transport ? `Transport: ${inv.transport}` : null,
        inv.transGstNo ? `Trans GST: ${inv.transGstNo}` : null,
        inv.lrNo ? `L.R. No: ${inv.lrNo}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      if (!order) {
        // Create Order without touching stock
        order = await prisma.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            customerName: customer.shopName,
            customerGstPan: customer.gstPanNo || "",
            customerAddress: inv.customerAddress || customer.address,
            businessType: customer.businessType || (inv.isCashMemo ? "CASH" : "RETAILER"),
            creditDays: inv.creditDays !== undefined ? inv.creditDays : customer.creditDays || 0,
            orderDate: new Date(inv.date),
            taxInvoiceDate: new Date(inv.date),
            taxInvoiceNumber: inv.invoiceNumber,
            status: "Delivered",
            subtotal: inv.subtotal,
            gstRate: inv.gstRate,
            gstAmount: inv.gstAmount,
            grandTotal: inv.grandTotal,
            totalPcs: inv.totalPcs,
            totalSets: inv.totalSets,
            placedBy: "Historical Import",
            taxInvoiceItems: JSON.stringify(inv.items),
            notes: noteText || null,
          },
        });
        importedOrders++;
      }

      // Check if SalesInvoice already exists
      let salesInv = await prisma.salesInvoice.findFirst({
        where: {
          OR: [
            { invoiceNumber: inv.invoiceNumber },
            { invoiceNumber: `INV-${inv.invoiceNumber}` },
          ],
        },
      });

      if (!salesInv) {
        await prisma.salesInvoice.create({
          data: {
            invoiceNumber: inv.invoiceNumber,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: customer.id,
            customerName: customer.shopName,
            customerGstPan: customer.gstPanNo || null,
            customerAddress: inv.customerAddress || customer.address,
            businessType: customer.businessType || (inv.isCashMemo ? "CASH" : "RETAILER"),
            invoiceDate: new Date(inv.date),
            paymentType: inv.isCashMemo ? "Cash" : "Credit",
            paymentStatus: inv.isCashMemo ? "Paid" : "Unpaid",
            subtotal: inv.subtotal,
            gstRate: inv.gstRate,
            gstAmount: inv.gstAmount,
            grandTotal: inv.grandTotal,
            paidAmount: inv.isCashMemo ? inv.grandTotal : 0,
            balanceAmount: inv.isCashMemo ? 0 : inv.grandTotal,
            totalSets: inv.totalSets,
            totalPcs: inv.totalPcs,
            items: JSON.stringify(inv.items),
            creditDays: inv.creditDays !== undefined ? inv.creditDays : inv.isCashMemo ? 0 : 45,
            notes: noteText || null,
            placedBy: "Historical Import",
          },
        });
        importedInvoices++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedInvoices} invoices (Invoices 1 to 39), ${importedOrders} orders, and created ${createdCustomers} customer profiles without modifying live stock.`,
      stats: {
        totalTarget: PAST_INVOICES_1_TO_39.length,
        importedInvoices,
        importedOrders,
        createdCustomers,
      },
    });
  } catch (error: any) {
    console.error("Error importing past invoices:", error);
    return NextResponse.json(
      { error: "Failed to import past invoices: " + error.message },
      { status: 500 }
    );
  }
}

// Support GET for direct browser or webhook invocation
export async function GET(request: NextRequest) {
  return POST(request);
}
