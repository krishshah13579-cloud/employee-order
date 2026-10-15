"use client";

import React from "react";
import { numberToIndianWords, formatCurrency } from "@/lib/utils";

export interface TaxInvoiceItem {
  id?: number;
  productName: string;
  colorSets?: any;
  sizeRatio?: string;
  pcsPerSet?: number;
  totalSets?: number;
  totalPcs?: number;
  unitPrice?: number;
  itemSubtotal?: number;
  hsnCode?: string;
}

export interface TaxInvoiceOrder {
  orderNumber: string;
  orderDate: string | Date;
  status?: string;
  customerName: string;
  customerGstPan?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  businessType?: string | null;
  creditDays?: number;
  subtotal: number;
  gstRate?: number;
  gstAmount: number;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  placedBy?: string | null;
  notes?: string | null;
  transportName?: string | null;
  items: TaxInvoiceItem[];
}

interface TaxInvoiceA4Props {
  order: TaxInvoiceOrder;
  copyTitle?: string; // e.g. "Duplicate" or "Original for Recipient"
}

export default function TaxInvoiceA4({ order, copyTitle = "Duplicate" }: TaxInvoiceA4Props) {
  // Parse order date formatted as DD/MM/YYYY
  const dateObj = order.orderDate ? new Date(order.orderDate) : new Date();
  const formattedDate = !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(
        2,
        "0"
      )}/${dateObj.getFullYear()}`
    : "";

  // Extract transport from notes if not directly present
  let resolvedTransport = order.transportName || "";
  if (!resolvedTransport && order.notes) {
    const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) {
      resolvedTransport = match[1].trim();
    }
  }

  const subtotal = Number(order.subtotal) || 0;
  const gstAmount = Number(order.gstAmount) || Math.round(subtotal * 0.05 * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;
  const grandTotal = Number(order.grandTotal) || Math.round(subtotal + gstAmount);
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;

  return (
    <div className="a4-invoice-wrapper bg-white text-black font-sans leading-tight text-[11px] print:text-[10.5px]">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Single Border Box */}
      <div className="border border-black max-w-[800px] mx-auto shadow-xs print:shadow-none bg-white">
        {/* 1. TOP HEADER: KRISH CLOTHING CO. */}
        <div className="border-b border-black text-center py-2 px-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-black font-serif">
            KRISH CLOTHING CO.
          </h1>
          <p className="text-[10px] sm:text-[11px] font-semibold text-black mt-0.5 tracking-tight">
            2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,
          </p>
          <p className="text-[10px] sm:text-[11px] font-semibold text-black tracking-tight">
            AHMEDABAD - 380008 (M) : 8128756632
          </p>
        </div>

        {/* 2. SUB-HEADER BAR: Debit Memo | TAX INVOICE | Duplicate */}
        <div className="border-b border-black grid grid-cols-3 items-center py-1 px-3 text-xs font-bold">
          <div className="text-left font-semibold text-[11px]">Debit Memo</div>
          <div className="text-center font-black text-sm tracking-widest uppercase">TAX INVOICE</div>
          <div className="text-right font-semibold text-[11px]">{copyTitle}</div>
        </div>

        {/* 3. RECEIVER (LEFT) & INVOICE / TRANSPORT DETAILS (RIGHT) */}
        <div className="border-b border-black grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black">
          {/* Left Column: Receiver / Customer Info */}
          <div className="p-2 space-y-0.5 text-[11px]">
            <div className="flex items-start gap-1">
              <span className="font-bold shrink-0">M/s. :</span>
              <span className="font-black text-xs uppercase tracking-wide">
                {order.customerName || "WALK-IN CUSTOMER"}
              </span>
            </div>
            <div className="text-[10.5px] pl-4 text-neutral-800 leading-snug">
              {order.customerAddress || "Direct Delivery"}
            </div>
            <div className="text-[10.5px] pl-4 font-semibold">
              {order.customerCity || "AHMEDABAD"}{" "}
              {order.customerState ? `- ${order.customerState}` : "- 363001"}
            </div>
            <div className="pt-1 flex items-center justify-between text-[10.5px]">
              <div>
                <span className="font-semibold">Place of Supply :</span>{" "}
                <span className="font-bold">24-Gujarat</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <div>
                <span className="font-semibold">GSTIN No. :</span>{" "}
                <span className="font-bold font-mono">
                  {order.customerGstPan || "URP (Unregistered)"}
                </span>
              </div>
              {order.customerPhone && (
                <div className="font-bold font-mono text-[11px] text-blue-900 print:text-black">
                  Mob No. {order.customerPhone}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Invoice No, Date, Transport */}
          <div className="text-[11px] divide-y divide-black">
            <div className="grid grid-cols-2 p-1.5 px-2">
              <div>
                <span className="font-bold">Invoice No.</span>{" "}
                <span className="font-mono font-bold ml-1">: {order.orderNumber}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 p-1.5 px-2">
              <div>
                <span className="font-bold">Date</span>{" "}
                <span className="font-mono font-semibold ml-1">: {formattedDate}</span>
              </div>
            </div>
            <div className="p-1.5 px-2">
              <span className="font-bold">TRANSPORT</span>{" "}
              <span className="font-black ml-1 uppercase text-blue-900 print:text-black">
                : {resolvedTransport || "Self / Direct Parcel"}
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-black">
              <div className="p-1 px-2">
                <span className="font-semibold text-[10px]">TRANS. GST No :</span>
              </div>
              <div className="p-1 px-2">
                <span className="font-semibold text-[10px]">L.R.NO. :</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. PRODUCT DETAILS TABLE */}
        <div className="overflow-x-auto min-h-[220px]">
          <table className="w-full text-left border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-black text-center font-bold bg-neutral-50/80 print:bg-transparent text-[10px]">
                <th className="border-r border-black py-1.5 px-1 w-8">SrNo</th>
                <th className="border-r border-black py-1.5 px-2 text-left">Product Design No.</th>
                <th className="border-r border-black py-1.5 px-1 w-14">HSN/SAC</th>
                <th className="border-r border-black py-1.5 px-1.5 w-16">Size</th>
                <th className="border-r border-black py-1.5 px-2">Color</th>
                <th className="border-r border-black py-1.5 px-1.5 w-12">Set</th>
                <th className="border-r border-black py-1.5 px-2 w-16">Qty</th>
                <th className="border-r border-black py-1.5 px-2 w-16 text-right">Rate</th>
                <th className="border-r border-black py-1.5 px-1 w-12">GST %</th>
                <th className="py-1.5 px-2 w-20 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/30 font-sans">
              {order.items.map((it, idx) => {
                // Parse color sets
                let colorSummary = "";
                let totalSets = it.totalSets || 0;
                let colorArr: { color: string; sets: number }[] = [];
                try {
                  if (Array.isArray(it.colorSets)) {
                    colorArr = it.colorSets;
                  } else if (typeof it.colorSets === "string") {
                    colorArr = JSON.parse(it.colorSets || "[]");
                  }
                } catch {
                  colorArr = [];
                }

                if (colorArr.length > 0) {
                  colorSummary = colorArr
                    .filter((c) => c.sets > 0)
                    .map((c) => `${c.color} (${c.sets}s)`)
                    .join(", ");
                  if (!totalSets) {
                    totalSets = colorArr.reduce((acc, c) => acc + (Number(c.sets) || 0), 0);
                  }
                }

                const totalPcs = it.totalPcs || totalSets * (it.pcsPerSet || 5);
                const unitPrice = Number(it.unitPrice) || 0;
                const itemAmount = Number(it.itemSubtotal) || totalPcs * unitPrice;

                return (
                  <tr key={idx} className="align-top">
                    <td className="border-r border-black py-1.5 px-1 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="border-r border-black py-1.5 px-2">
                      <div className="font-bold text-black">{it.productName}</div>
                      {it.sizeRatio && (
                        <div className="text-[9.5px] text-neutral-600 font-mono">
                          Ratio: {it.sizeRatio}
                        </div>
                      )}
                    </td>
                    <td className="border-r border-black py-1.5 px-1 text-center font-mono text-[10px]">
                      {it.hsnCode || "6203"}
                    </td>
                    <td className="border-r border-black py-1.5 px-1.5 text-center font-mono">
                      {it.sizeRatio || "30-38"}
                    </td>
                    <td className="border-r border-black py-1.5 px-2 text-[10px] font-medium leading-tight">
                      {colorSummary || "Standard Mix"}
                    </td>
                    <td className="border-r border-black py-1.5 px-1.5 text-center font-bold font-mono">
                      {totalSets ? totalSets.toFixed(2) : "1.00"}
                    </td>
                    <td className="border-r border-black py-1.5 px-2 text-center font-bold font-mono">
                      {totalPcs.toFixed(2)} PCS
                    </td>
                    <td className="border-r border-black py-1.5 px-2 text-right font-mono">
                      {unitPrice.toFixed(2)}
                    </td>
                    <td className="border-r border-black py-1.5 px-1 text-center font-mono">5.00</td>
                    <td className="py-1.5 px-2 text-right font-bold font-mono">
                      {itemAmount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}

              {/* Empty placeholder rows to maintain standard invoice height on print */}
              {Array.from({ length: Math.max(0, 4 - order.items.length) }).map((_, emptyIdx) => (
                <tr key={`empty-${emptyIdx}`} className="h-6">
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-2">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1.5">&nbsp;</td>
                  <td className="border-r border-black py-1 px-2">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1.5">&nbsp;</td>
                  <td className="border-r border-black py-1 px-2">&nbsp;</td>
                  <td className="border-r border-black py-1 px-2">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="py-1 px-2">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. SUB TOTAL ROW */}
        <div className="border-t border-b border-black grid grid-cols-12 font-bold py-1 px-2 bg-neutral-50/60 print:bg-transparent">
          <div className="col-span-6 font-mono text-[10.5px]">
            <span className="font-bold">GSTIN No.:</span> 24LAAPS9916E1ZD
          </div>
          <div className="col-span-2 text-center font-mono text-[10.5px]">
            {order.totalPcs.toFixed(3)}
          </div>
          <div className="col-span-2 text-right uppercase text-[10.5px]">Sub Total</div>
          <div className="col-span-2 text-right font-mono text-[11px]">
            {subtotal.toFixed(2)}
          </div>
        </div>

        {/* 6. BANK DETAILS (LEFT) & TAX BREAKDOWN (RIGHT) */}
        <div className="border-b border-black grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
          {/* Left: Bank Details & Amount in Words */}
          <div className="md:col-span-7 p-2 space-y-1 text-[10.5px]">
            <div className="grid grid-cols-3">
              <span className="font-bold">Bank Name</span>
              <span className="col-span-2 font-mono font-semibold">: ICICI BANK</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="font-bold">Bank A/c. No.</span>
              <span className="col-span-2 font-mono font-bold">: 750705000692</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="font-bold">RTGS/IFSC Code</span>
              <span className="col-span-2 font-mono font-bold">: ICIC0007507</span>
            </div>
            <div className="pt-1 border-t border-neutral-300">
              <span className="font-bold">Total GST :</span>{" "}
              <span className="italic font-medium">{numberToIndianWords(gstAmount)}</span>
            </div>
            <div>
              <span className="font-bold">Bill Amount :</span>{" "}
              <span className="italic font-black">{numberToIndianWords(grandTotal)}</span>
            </div>
          </div>

          {/* Right: Tax Breakdown */}
          <div className="md:col-span-5 p-2 space-y-1 text-[10.5px]">
            <div className="flex justify-between">
              <span className="font-bold">Taxable Amount</span>
              <span className="font-mono font-bold">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-800">
              <span>Central Tax 2.50%</span>
              <span className="font-mono">{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-800">
              <span>State/UT Tax 2.50%</span>
              <span className="font-mono">{sgst.toFixed(2)}</span>
            </div>
            <div className="pt-1.5 border-t border-black flex justify-between font-black text-xs">
              <span className="uppercase tracking-wider">Grand Total</span>
              <span className="font-mono text-sm">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* 7. NOTE: PAYMENT WITHIN X DAYS */}
        <div className="border-b border-black py-1 px-3 text-[11px] font-bold">
          <span className="uppercase">Note : </span>
          <span className="underline uppercase tracking-wide">
            {creditDays > 0 ? `PAYMENT WITHIN ${creditDays} DAYS.` : "ADVANCE PAYMENT (0 DAYS CREDIT)."}
          </span>
        </div>

        {/* 8. TERMS & CONDITIONS (LEFT) & SIGNATURE (RIGHT) */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black min-h-[105px]">
          {/* Terms & Conditions */}
          <div className="md:col-span-7 p-2 text-[9.5px] leading-tight space-y-0.5">
            <div className="font-bold underline uppercase text-[10px] mb-1">
              Terms &amp; Condition :
            </div>
            <div>1. Goods once sold will not be taken back.</div>
            <div>2. Interest @18% p.a. will be charged if payment is not made within due date.</div>
            <div>3. Our risk and responsibility ceases as soon as the goods leave our premises.</div>
            <div>4. &ldquo;Subject to &apos;AHMEDABAD&apos; Jurisdiction only. E.&amp;.O.E&rdquo;</div>
            <div className="font-semibold underline">
              5. Any damages or problem in any products should be informed within 7 days of purchase.
            </div>
          </div>

          {/* Signature Area */}
          <div className="md:col-span-5 p-2 flex flex-col justify-between text-right">
            <div className="font-bold text-[11px] uppercase tracking-wider">
              For, KRISH CLOTHING CO.
            </div>
            <div className="py-1 flex justify-end">
              <img
                src="/images/krish-clothing-signature.png"
                alt="Krish Signature"
                className="h-12 object-contain"
                onError={(e) => {
                  // Fallback if image not rendered
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="text-[10px] font-bold text-neutral-800">
              (Authorised Signatory)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
