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

      // Synchronize OrderItem records for this order without touching stock
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id },
      });

      const formattedTaxInvoiceItems: any[] = [];

      for (const it of inv.items) {
        // Match or find product in catalog
        const cleanName = it.productName.trim();
        const m = cleanName.match(/\d+/);
        const num = m ? parseInt(m[0], 10) : null;

        let prod = await prisma.product.findFirst({
          where: {
            OR: [
              { name: { equals: cleanName } },
              ...(num !== null ? [{ name: { contains: String(num) } }] : []),
            ],
          },
        });

        if (!prod) {
          const baseMrp = it.mrp || (it.unitPrice ? Math.round(it.unitPrice * 2) : 1500);
          prod = await prisma.product.create({
            data: {
              name: cleanName,
              category: "FORMAL WEAR",
              colorsAvailable: it.color || "Standard Mix",
              sizesRatio: it.sizeRatio || "30 to 38",
              sizesList: it.sizesList || "30, 32, 34, 36, 38",
              pcsPerSet: it.pcsPerSet || 5,
              mrp: baseMrp,
              retailerPrice: it.unitPrice || Math.round(baseMrp / 2),
              wholesalerPrice: it.unitPrice ? Math.max(0, it.unitPrice - 100) : Math.round(baseMrp / 2 - 100),
              price: it.unitPrice || Math.round(baseMrp / 2),
              setsColorwise: "{}",
              isActive: true,
            },
          });
        }

        let colorSetsArray = (it as any).colorSets || [];
        if (!colorSetsArray || colorSetsArray.length === 0) {
          if (it.color && it.color.trim()) {
            colorSetsArray = [{ color: it.color.trim(), sets: it.totalSets || 1 }];
          } else {
            colorSetsArray = [];
          }
        }

        const createdItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: prod.id,
            productName: it.productName,
            colorSets: JSON.stringify(colorSetsArray),
            sizeRatio: it.sizeRatio || prod.sizesRatio || "30 to 38",
            sizesList: it.sizesList || prod.sizesList || "30, 32, 34, 36, 38",
            pcsPerSet: it.pcsPerSet || prod.pcsPerSet || 5,
            totalSets: Number(it.totalSets) || 0,
            totalPcs: Number(it.totalPcs) || 0,
            unitPrice: Number(it.unitPrice) || 0,
            itemSubtotal: Number(it.itemSubtotal) || 0,
            notes: it.color ? `Color: ${it.color}` : null,
          },
        });

        formattedTaxInvoiceItems.push({
          id: createdItem.id,
          productId: prod.id,
          productName: it.productName,
          sizeRatio: it.sizeRatio || prod.sizesRatio || "30 to 38",
          sizesList: it.sizesList || prod.sizesList || "30, 32, 34, 36, 38",
          pcsPerSet: it.pcsPerSet || prod.pcsPerSet || 5,
          totalSets: Number(it.totalSets) || 0,
          totalPcs: Number(it.totalPcs) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          itemSubtotal: Number(it.itemSubtotal) || 0,
          color: it.color || "",
          colorSets: colorSetsArray,
          mrp: it.mrp || prod.mrp,
        });
      }

      // Update Order taxInvoiceItems
      await prisma.order.update({
        where: { id: order.id },
        data: {
          taxInvoiceItems: JSON.stringify(formattedTaxInvoiceItems),
          taxInvoiceNumber: inv.invoiceNumber,
          status: "Delivered",
        },
      });

      // Check if SalesInvoice already exists
      let salesInv = await prisma.salesInvoice.findFirst({
        where: {
          OR: [
            { invoiceNumber: inv.invoiceNumber },
            { invoiceNumber: `INV-${inv.invoiceNumber}` },
            { orderId: order.id },
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
            items: JSON.stringify(formattedTaxInvoiceItems),
            creditDays: inv.creditDays !== undefined ? inv.creditDays : inv.isCashMemo ? 0 : 45,
            notes: noteText || null,
            placedBy: "Historical Import",
          },
        });
        importedInvoices++;
      } else {
        await prisma.salesInvoice.update({
          where: { id: salesInv.id },
          data: {
            items: JSON.stringify(formattedTaxInvoiceItems),
            totalSets: inv.totalSets,
            totalPcs: inv.totalPcs,
            subtotal: inv.subtotal,
            grandTotal: inv.grandTotal,
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
