import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, FileText, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions | IQ Trousers • Krish Clothing Co.",
  description: "Wholesale terms and conditions of Krish Clothing Co. (IQ Trousers), Ahmedabad.",
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider mb-3">
            <Shield size={14} />
            <span>Wholesale Policy</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Last Updated: October 2026 • Krish Clothing Co. (IQ Trousers), Ahmedabad
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <span>1. Wholesale Trade Terms</span>
            </h2>
            <p>
              Krish Clothing Co. (“Company”, “IQ Trousers”) deals strictly on B2B wholesale terms with registered garment retailers, semi-wholesalers, and distributors. All purchases are sold in standardized multi-size ratio packs (e.g., 30 to 38, 32 to 38).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <span>2. Pricing, Invoicing &amp; GST</span>
            </h2>
            <p>
              All prices quoted are ex-factory Ahmedabad wholesale rates. Goods and Services Tax (GST @ 5%) is charged on all taxable sales in accordance with Government of India regulations. Official Tax Invoices are issued for all dispatches.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <span>3. Payment Terms &amp; Weekly Credit Limit</span>
            </h2>
            <p>
              Credit terms are granted strictly subject to prior approval (standard 45 days, or as agreed in writing). Payment must be made every week and completed in full within the sanctioned credit days limit. Overdue balances beyond the credit period are subject to commercial interest @ 18% per annum.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <span>4. Returns &amp; Replacement Policy</span>
            </h2>
            <p>
              Goods once sold will not be accepted back except in cases of verified manufacturing defects reported within 7 days of parcel delivery. Any accepted return requires an official Return Invoice issued by the company.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-orange-600" />
              <span>5. Jurisdiction</span>
            </h2>
            <p>
              All disputes, claims, and wholesale contracts are subject strictly to Ahmedabad (Gujarat) jurisdiction only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
