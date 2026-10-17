import React from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Package, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Wholesale Dispatch Policy | IQ Trousers • Krish Clothing Co.",
  description: "Wholesale transport and dispatch policy of Krish Clothing Co. (IQ Trousers), Ahmedabad.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition mb-6"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Truck size={14} />
            <span>Transport &amp; Dispatch</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Wholesale Dispatch Policy
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Krish Clothing Co. (IQ Trousers), Ahmedabad • Goods Delivery Terms
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Package size={18} className="text-blue-600" />
              <span>1. Order Processing &amp; Packing</span>
            </h2>
            <p>
              Orders are packaged in secure corrugated cartons or water-resistant HDPE bags with distinct company seals. Each parcel contains the packing slip corresponding to the Tax Invoice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Truck size={18} className="text-blue-600" />
              <span>2. Transport &amp; Logistics Booking</span>
            </h2>
            <p>
              Parcels are dispatched through client-preferred transport agencies (e.g. V-Trans, ARC, TCI, Mahaveer, Patel Roadways, or local city transport). If no preferred transport is specified on the Order Form, dispatch is made through standard reliable transport connecting to the client's destination.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              <span>3. Dispatch Timelines</span>
            </h2>
            <p>
              Ready stock styles are normally dispatched within 24 to 48 hours of order confirmation. Transit delivery times depend on destination distance and carrier logistics schedule.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <span>4. Transit Risk &amp; Lorry Receipt (LR)</span>
            </h2>
            <p>
              Once goods are delivered to the designated transport company and a valid Lorry Receipt (LR / Bilty) is issued, LR details and copy will be shared with the client via WhatsApp. Freight charges (To-Pay / Paid) are billed as agreed on the Order Form.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
