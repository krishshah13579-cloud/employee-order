import Link from "next/link";
import { Ruler, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Size Guide | IQ Trousers",
  description:
    "Official measurement guide and sizing tables for IQ Trousers and Formals by Krish Clothing Co.",
};

const TROUSER_SIZING = [
  { size: "28", waist: '29.5" - 30"', hip: '11"', length: '41"' },
  { size: "30", waist: '31.5" - 32"', hip: '11.5"', length: '41"' },
  { size: "32", waist: '33.5" - 34"', hip: '12"', length: '41"' },
  { size: "34", waist: '35.5" - 36"', hip: '12.5"', length: '41"' },
  { size: "36", waist: '37.5" - 38"', hip: '13"', length: '41"' },
  { size: "38", waist: '39.5" - 40"', hip: '13.5"', length: '41"' },
  { size: "40", waist: '41.5" - 42"', hip: '14"', length: '41"' },
  { size: "42", waist: '43.5" - 44"', hip: '14.5"', length: '41"' },
  { size: "44", waist: '45.5" - 46"', hip: '15"', length: '41"' },
];

const FORMAL_SIZING = [
  { size: "30", waist: '28"', hip: '11"', length: '41"' },
  { size: "32", waist: '30"', hip: '11.5"', length: '41"' },
  { size: "34", waist: '32"', hip: '12"', length: '41"' },
  { size: "36", waist: '34"', hip: '12.5"', length: '41"' },
  { size: "38", waist: '36"', hip: '13"', length: '41"' },
  { size: "40", waist: '38"', hip: '13.5"', length: '41"' },
  { size: "42", waist: '40"', hip: '14"', length: '41"' },
  { size: "44", waist: '42"', hip: '14.5"', length: '41"' },
];

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 text-neutral-800 text-xs font-semibold uppercase tracking-wider mb-4">
            <Ruler className="w-3.5 h-3.5 text-orange-600" />
            <span>Fit &amp; Measurements</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 tracking-tight">
            IQ Trousers Size Guide
          </h1>
          <p className="text-neutral-500 text-sm sm:text-base mt-3 leading-relaxed">
            Every pair is engineered with precision tailoring. Use the official measurement tables below to find your ideal fit.
          </p>
        </div>

        {/* How to Measure Section */}
        <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-200 mb-16">
          <h2 className="text-xl font-bold text-neutral-900 mb-6">
            How to Measure
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-neutral-700">
            <div className="p-5 bg-white rounded-xl border border-neutral-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Step 1
              </span>
              <h3 className="font-bold text-neutral-900 text-base mb-1.5">Waist</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                Measure the narrowest part of your waistline where you naturally wear your trousers.
              </p>
            </div>

            <div className="p-5 bg-white rounded-xl border border-neutral-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Step 2
              </span>
              <h3 className="font-bold text-neutral-900 text-base mb-1.5">Hips</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                Measure around the fullest part of your hips, keeping the tape straight and level.
              </p>
            </div>

            <div className="p-5 bg-white rounded-xl border border-neutral-200/80">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Step 3
              </span>
              <h3 className="font-bold text-neutral-900 text-base mb-1.5">Length</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                Measure from the top of the waistband straight down to the bottom hem (Standard 41&quot;).
              </p>
            </div>
          </div>
        </div>

        {/* Table 1: Men's Trouser */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden mb-12">
          <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Size Table Men&apos;s Trouser (Everyday Casuals)
            </h2>
            <span className="text-xs text-neutral-300 font-medium">Standard 41&quot; Length</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-700">
              <thead className="bg-neutral-50 text-xs uppercase font-semibold text-neutral-800 border-b border-neutral-200">
                <tr>
                  <th className="py-3.5 px-6">Size (Inches)</th>
                  <th className="py-3.5 px-6">Waist Range</th>
                  <th className="py-3.5 px-6">Hip Measure</th>
                  <th className="py-3.5 px-6">Standard Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono text-xs sm:text-sm">
                {TROUSER_SIZING.map((row) => (
                  <tr key={row.size} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-6 font-bold text-neutral-900">{row.size}</td>
                    <td className="py-3 px-6">{row.waist}</td>
                    <td className="py-3 px-6">{row.hip}</td>
                    <td className="py-3 px-6 font-semibold text-neutral-900">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Formals */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden mb-16">
          <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Formal Wear Fit Matrix
            </h2>
            <span className="text-xs text-neutral-300 font-medium">Executive Drape</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-700">
              <thead className="bg-neutral-50 text-xs uppercase font-semibold text-neutral-800 border-b border-neutral-200">
                <tr>
                  <th className="py-3.5 px-6">Size</th>
                  <th className="py-3.5 px-6">Actual Waist</th>
                  <th className="py-3.5 px-6">Hip</th>
                  <th className="py-3.5 px-6">Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono text-xs sm:text-sm">
                {FORMAL_SIZING.map((row) => (
                  <tr key={row.size} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-6 font-bold text-neutral-900">{row.size}</td>
                    <td className="py-3 px-6">{row.waist}</td>
                    <td className="py-3 px-6">{row.hip}</td>
                    <td className="py-3 px-6 font-semibold text-neutral-900">{row.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wholesale Pack Note */}
        <div className="p-6 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-orange-950 text-sm">
              Wholesale Packaging Standard
            </h3>
            <p className="text-xs text-orange-900/80 mt-0.5">
              IQ Trousers are supplied in master packs of 5 pieces per set with mandatory ratio (30, 32, 34, 36, 38).
            </p>
          </div>
          <Link
            href="/orders/new"
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-md transition"
          >
            Take Order Now →
          </Link>
        </div>
      </div>
    </div>
  );
}
