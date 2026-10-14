import Link from "next/link";
import { ArrowRight, Sparkles, Feather, Scissors, Truck, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "About Us | IQ Trousers",
  description:
    "Tailored for Life. Engineered for Comfort. Learn about Our Story, Our Mission, and the IQ Standards behind IQ Trousers.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <section className="bg-neutral-950 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-neutral-900">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-orange-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Krish Clothing Co.</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            About IQ Trousers
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto">
            Engineered precision garments crafted for Indian comfort and executive lifestyle.
          </p>
        </div>
      </section>

      {/* Main Narrative */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                The Origin
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                Our Story
              </h2>
              <p className="text-neutral-700 text-base leading-relaxed">
                At IQ Trousers, we believe that modern professionals shouldn&apos;t have to compromise between sharp executive looks and all-day comfort. Based in Gujarat&apos;s renowned textile hub, we manufacture precision-engineered trousers featuring our proprietary adaptive flex waistband.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                The Purpose
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                Our Mission
              </h2>
              <p className="text-neutral-700 text-base leading-relaxed">
                To equip retailers and wholesale partners across India with high-turnover menswear styles that guarantee customer satisfaction through superior fabric hand-feel, consistent size ratios, and dependable durability.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-neutral-100 shadow-xl border border-neutral-200">
              <img
                src="https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=1000"
                alt="IQ Trousers - Precision & Comfort"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-8">
                <div className="text-white">
                  <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                    Krish Clothing Co.
                  </p>
                  <p className="text-lg font-bold mt-0.5">
                    Everyday Casuals &amp; Formal Wear
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The IQ Standards (3 Pillars) */}
        <div className="mt-20 pt-16 border-t border-neutral-200">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
              Our Core Pillars
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight mt-2">
              The IQ Standards
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-200">
              <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-orange-600 mb-5 shadow-xs">
                <Feather className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                Adaptive Comfort
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Concealed flex waistbands that expand effortlessly during extended desk sitting, driving, and travel.
              </p>
            </div>

            <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-200">
              <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-orange-600 mb-5 shadow-xs">
                <Scissors className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                Precision Tailoring
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Double-needle reinforced seams, premium YKK sliders, and deep cotton pocket bags built to last.
              </p>
            </div>

            <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-200">
              <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-orange-600 mb-5 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">
                Fabric Integrity
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Colour-fast dyes and pre-shrunk high-twist cottons that retain rich depth wash after wash.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
