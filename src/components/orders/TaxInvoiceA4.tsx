"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";

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

export default function TaxInvoiceA4({ order, copyTitle = "Original" }: TaxInvoiceA4Props) {
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

  // Once dispatched, label as Invoice No., otherwise Order No.
  const isDispatched = order.status === "Dispatched" || order.status === "Delivered";
  const numberLabel = isDispatched ? "Invoice No." : "Order No.";

  // Calculate target empty filler rows to create classic invoice look with vertical column lines
  // Standard invoice table should have at least 6 rows of height
  const itemsCount = order.items?.length || 0;
  const emptyRowsCount = Math.max(0, 6 - itemsCount);

  return (
    <div className="a4-invoice-wrapper font-sans text-black leading-tight text-[11px] print:text-[10px]">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 7mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav, header, footer, aside, .print\\:hidden, #toast-container, .toast-container {
            display: none !important;
          }
          .a4-invoice-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .a4-invoice-box {
            border: 1.5px solid #000 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Main Single Border Box matching physical invoice */}
      <div
        className="a4-invoice-box mx-auto bg-white"
        style={{
          border: "1.5px solid #000000",
          maxWidth: "780px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* 1. TOP HEADER: KRISH CLOTHING CO. */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            textAlign: "center",
            padding: "6px 12px",
          }}
        >
          <h1
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: "22px",
              fontWeight: "900",
              letterSpacing: "1px",
              textTransform: "uppercase",
              margin: 0,
              lineHeight: "1.1",
            }}
          >
            KRISH CLOTHING CO.
          </h1>
          <p
            style={{
              fontSize: "10px",
              fontWeight: "700",
              margin: "2px 0 0 0",
              letterSpacing: "-0.2px",
            }}
          >
            2ND FLOOR, Q-8,SAMET BUSINESS PARK,NEAR PARISHKAR-2,KHOKHARA CIRCLE,MANINAGAR,
          </p>
          <p
            style={{
              fontSize: "10px",
              fontWeight: "700",
              margin: "1px 0 0 0",
              letterSpacing: "-0.2px",
            }}
          >
            AHMEDABAD - 380008 (M) : 8128756632
          </p>
        </div>

        {/* 2. SUB-HEADER BAR: Debit Memo | TAX INVOICE | Duplicate */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "3px 10px",
            fontSize: "11px",
            fontWeight: "bold",
          }}
        >
          <div style={{ width: "25%", textAlign: "left" }}>Debit Memo</div>
          <div
            style={{
              width: "50%",
              textAlign: "center",
              fontWeight: "900",
              fontSize: "13px",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {isDispatched ? "TAX INVOICE" : "ORDER FORM"}
          </div>
          <div style={{ width: "25%", textAlign: "right" }}>{copyTitle}</div>
        </div>

        {/* 3. RECEIVER (LEFT ~58%) & INVOICE / TRANSPORT DETAILS (RIGHT ~42%) */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            minHeight: "86px",
          }}
        >
          {/* Left Column: Receiver / Customer Info */}
          <div
            style={{
              width: "58%",
              borderRight: "1px solid #000000",
              padding: "5px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              fontSize: "10.5px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span style={{ fontWeight: "bold", flexShrink: 0 }}>M/s. :</span>
                <span
                  style={{
                    fontWeight: "900",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                  }}
                >
                  {order.customerName || "WALK-IN CUSTOMER"}
                </span>
              </div>
              <div
                style={{
                  paddingLeft: "34px",
                  fontSize: "10px",
                  lineHeight: "1.25",
                  color: "#111",
                  marginTop: "1px",
                  textTransform: "uppercase",
                }}
              >
                {order.customerAddress || "Direct Delivery"}
              </div>
              <div
                style={{
                  paddingLeft: "34px",
                  fontSize: "10px",
                  fontWeight: "600",
                  marginTop: "1px",
                  textTransform: "uppercase",
                }}
              >
                {order.customerCity || "AHMEDABAD"}{" "}
                {order.customerState ? `- ${order.customerState}` : "- 363001"}
              </div>
            </div>

            <div style={{ marginTop: "4px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "10px",
                }}
              >
                <div>
                  <span style={{ fontWeight: "600" }}>Place of Supply :</span>{" "}
                  <strong>24-Gujarat</strong>
                </div>
                {order.customerPhone && (
                  <div
                    style={{
                      fontWeight: "bold",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "#000",
                    }}
                  >
                    Mob No. {order.customerPhone}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "10px", marginTop: "1px" }}>
                <span style={{ fontWeight: "600" }}>GSTIN No. :</span>{" "}
                <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                  {order.customerGstPan || "URP (Unregistered)"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Order No / Invoice No, Date, Transport (Clean: NO GST or LR) */}
          <div
            style={{
              width: "42%",
              display: "flex",
              flexDirection: "column",
              fontSize: "10.5px",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #000000",
                padding: "5px 10px",
                display: "flex",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>{numberLabel}</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                : {order.orderNumber}
              </span>
            </div>

            <div
              style={{
                borderBottom: "1px solid #000000",
                padding: "5px 10px",
                display: "flex",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>Date</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600" }}>
                : {formattedDate}
              </span>
            </div>

            <div
              style={{
                padding: "5px 10px",
                display: "flex",
                flex: 1,
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold", width: "95px" }}>TRANSPORT</span>
              <span
                style={{
                  fontWeight: "900",
                  textTransform: "uppercase",
                  color: "#000",
                }}
              >
                : {resolvedTransport || "Patel Transport Co."}
              </span>
            </div>
          </div>
        </div>

        {/* 4. PRODUCT DETAILS TABLE (Exact 10 columns matching physical sample) */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10.5px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid #000000",
                fontSize: "10px",
                fontWeight: "bold",
                textAlign: "center",
                backgroundColor: "#fafafa",
              }}
            >
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "5%" }}>
                SrNo
              </th>
              <th
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 6px",
                  width: "27%",
                  textAlign: "left",
                }}
              >
                Product Design No.
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "8%" }}>
                HSN/SAC
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "9%" }}>
                Size
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 4px", width: "11%" }}>
                Color
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "7%" }}>
                Set
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 4px", width: "11%" }}>
                Qty
              </th>
              <th
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 4px",
                  width: "8%",
                  textAlign: "right",
                }}
              >
                Rate
              </th>
              <th style={{ borderRight: "1px solid #000000", padding: "4px 2px", width: "5%" }}>
                GST %
              </th>
              <th style={{ padding: "4px 6px", width: "9%", textAlign: "right" }}>
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
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
                <tr key={idx} style={{ verticalAlign: "top" }}>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td style={{ borderRight: "1px solid #000000", padding: "4px 6px" }}>
                    <div style={{ fontWeight: "bold", color: "#000" }}>{it.productName}</div>
                    {it.sizeRatio && (
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#444",
                          fontFamily: "monospace",
                        }}
                      >
                        Ratio: {it.sizeRatio}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontFamily: "monospace",
                      fontSize: "10px",
                    }}
                  >
                    {it.hsnCode || "6203"}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    {it.sizeRatio || "28-36"}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 4px",
                      fontSize: "10px",
                      fontWeight: "500",
                      lineHeight: "1.2",
                    }}
                  >
                    {colorSummary || "Standard Mix"}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {totalSets ? totalSets.toFixed(2) : "1.00"}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 4px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {totalPcs.toFixed(2)} PCS
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 4px",
                      textAlign: "right",
                      fontFamily: "monospace",
                    }}
                  >
                    {unitPrice.toFixed(2)}
                  </td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    5.00
                  </td>
                  <td
                    style={{
                      padding: "4px 6px",
                      textAlign: "right",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {itemAmount.toFixed(2)}
                  </td>
                </tr>
              );
            })}

            {/* Empty filler rows with vertical grid borders to match physical tax invoice layout */}
            {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => (
              <tr key={`empty-${emptyIdx}`} style={{ height: "24px" }}>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td style={{ borderRight: "1px solid #000000" }}>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>

          {/* 5. SUB TOTAL ROW (Aligned perfectly with table columns) */}
          <tfoot>
            <tr
              style={{
                borderTop: "1px solid #000000",
                borderBottom: "1px solid #000000",
                fontWeight: "bold",
                backgroundColor: "#fafafa",
                fontSize: "10px",
              }}
            >
              <td
                colSpan={6}
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 8px",
                  fontFamily: "monospace",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: "bold" }}>GSTIN No.:</span> 24LAAPS9916E1ZD
              </td>
              <td
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 4px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                }}
              >
                {order.totalPcs.toFixed(3)}
              </td>
              <td
                colSpan={2}
                style={{
                  borderRight: "1px solid #000000",
                  padding: "4px 6px",
                  textAlign: "right",
                  textTransform: "uppercase",
                  fontWeight: "bold",
                }}
              >
                SUB TOTAL
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  textAlign: "right",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  fontSize: "10.5px",
                }}
              >
                {subtotal.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* 6. BANK DETAILS (LEFT ~58%) & TAX BREAKDOWN (RIGHT ~42%) */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            display: "flex",
            fontSize: "10px",
          }}
        >
          {/* Left Column: Bank Details (No amounts in words as requested) */}
          <div
            style={{
              width: "58%",
              borderRight: "1px solid #000000",
              padding: "6px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-around",
              minHeight: "70px",
            }}
          >
            <div style={{ display: "flex" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>Bank Name</span>
              <span style={{ fontFamily: "monospace", fontWeight: "600" }}>: ICICI BANK</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>Bank A/c. No.</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>: 750705000692</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ fontWeight: "bold", width: "110px" }}>RTGS/IFSC Code</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>: ICIC0007507</span>
            </div>
          </div>

          {/* Right Column: Tax Breakdown */}
          <div
            style={{
              width: "42%",
              display: "flex",
              flexDirection: "column",
              fontSize: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "3px 10px",
              }}
            >
              <span>Taxable Amount</span>
              <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                {subtotal.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "2px 10px",
                color: "#222",
              }}
            >
              <span>Central Tax 2.50%</span>
              <span style={{ fontFamily: "monospace" }}>{cgst.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "2px 10px",
                color: "#222",
              }}
            >
              <span>State/UT Tax 2.50%</span>
              <span style={{ fontFamily: "monospace" }}>{sgst.toFixed(2)}</span>
            </div>
            <div
              style={{
                borderTop: "1px solid #000000",
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 10px",
                fontWeight: "900",
                fontSize: "11.5px",
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                Grand Total
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "13px" }}>
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* 7. NOTE: PAYMENT EVERY WEEK AND SHOULD BE COMPLETED WITHIN X DAYS */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            padding: "4px 10px",
            fontSize: "10px",
            fontWeight: "bold",
          }}
        >
          <span style={{ textTransform: "uppercase" }}>Note : </span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.4px" }}>
            PAYMENT EVERY WEEK AND SHOULD BE COMPLETED WITHIN{" "}
            {creditDays > 0 ? `${creditDays} DAYS` : "_____ DAYS"}.
          </span>
        </div>

        {/* 8. TERMS & CONDITIONS (LEFT ~65%) & SIGNATURE (RIGHT ~35%) */}
        <div
          style={{
            display: "flex",
            minHeight: "95px",
          }}
        >
          {/* Terms & Conditions */}
          <div
            style={{
              width: "65%",
              borderRight: "1px solid #000000",
              padding: "5px 10px",
              fontSize: "9px",
              lineHeight: "1.35",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                textDecoration: "underline",
                textTransform: "uppercase",
                fontSize: "9.5px",
                marginBottom: "2px",
              }}
            >
              Terms &amp; Condition :
            </div>
            <div>1. Goods once sold will not be taken back.</div>
            <div>2. Interest @18% p.a. will be charged if payment is not made within due date.</div>
            <div>3. Our risk and responsibility ceases as soon as the goods leave our premises.</div>
            <div>4. &ldquo;Subject to &apos;AHMEDABAD&apos; Jurisdiction only. E.&amp;.O.E&rdquo;</div>
            <div style={{ fontWeight: "700", textDecoration: "underline" }}>
              5. Any damages or problem in any products should be informed within 7 days of purchase.
            </div>
          </div>

          {/* Signature Area */}
          <div
            style={{
              width: "35%",
              padding: "5px 10px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              For, KRISH CLOTHING CO.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "1px 0" }}>
              <img
                src="/images/krish-clothing-signature.png"
                alt="Authorised Signatory"
                style={{ height: "45px", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div style={{ fontSize: "10px", fontWeight: "bold", color: "#111" }}>
              (Authorised Signatory)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
