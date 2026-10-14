"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  Mail,
  MapPin,
  Sparkles,
  Loader2,
  AlertCircle,
  Phone,
  Clock,
  ShieldCheck,
} from "lucide-react";

export default function Footer() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [subscribeConsent, setSubscribeConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribedEmail, setSubscribedEmail] = useState<string | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First Name is mandatory.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last Name is mandatory.");
      return;
    }
    if (!email.trim()) {
      setError("Email Address is mandatory.");
      return;
    }
    if (!subscribeConsent) {
      setError("Please check 'Subscribe to the newsletter' to receive your discount.");
      return;
    }

    setLoading(true);
    // Simulate instant newsletter confirmation
    setTimeout(() => {
      setLoading(false);
      setSubscribedEmail(email.trim());
    }, 600);
  };

  return (
    <footer className="bg-neutral-950 text-white border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Newsletter Section */}
        <div className="bg-neutral-900/90 rounded-3xl p-8 sm:p-12 border border-neutral-800 mb-16 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Exclusive Welcome Offer</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white">
              Subscribe to the IQ Trousers Newsletter
            </h2>
            <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
              Join our sartorial mailing list for new trouser arrivals, wholesale fabric insights, and bulk manufacturing updates. Enter your details below to receive an exclusive <strong className="text-white font-semibold">10% discount code delivered directly to your inbox</strong>.
            </p>
          </div>

          {subscribedEmail ? (
            <div className="mt-8 p-6 bg-neutral-800/90 border border-neutral-700 rounded-2xl max-w-xl animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
                <Check className="w-5 h-5 shrink-0" />
                <span>Subscription Confirmed!</span>
              </div>
              <p className="text-sm text-neutral-200 mb-2">
                Your exclusive <strong className="text-amber-400 font-semibold">10% discount code</strong> has been sent directly to:
              </p>
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-black border border-neutral-700 rounded-xl font-mono text-sm text-white mb-3">
                <Mail className="w-4 h-4 text-neutral-400" />
                <span>{subscribedEmail}</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Please check your email inbox (and spam/promotions folder) for your welcome discount code.
              </p>
            </div>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="mt-8 space-y-4 max-w-xl">
              {error && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white transition-all"
                  />
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={subscribeConsent}
                    onChange={(e) => setSubscribeConsent(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-neutral-700 bg-neutral-950 text-white focus:ring-white"
                  />
                  <span className="text-xs text-neutral-300 leading-snug">
                    I agree to subscribe to the newsletter and receive promotions, updates, and my 10% discount code. <span className="text-red-400">*</span>
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-white text-black font-semibold text-xs tracking-wider uppercase rounded-xl hover:bg-neutral-200 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Subscribing...</span>
                    </>
                  ) : (
                    <span>Submit & Claim 10% Off</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Links & Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-neutral-800">
          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Explore
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/products"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Shop All Trousers
                </Link>
              </li>
              <li>
                <Link
                  href="/orders/new"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Order Form
                </Link>
              </li>
              <li>
                <Link
                  href="/orders"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Wholesale Orders
                </Link>
              </li>
              <li>
                <Link
                  href="/size-guide"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Size &amp; Fit Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                >
                  Admin Portal →
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Collections
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/products?category=EVERYDAY+CASUAL"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Everyday Casuals
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=FORMAL+WEAR"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Formal Wear
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=LINEN"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Pure Linen &amp; Blends
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Heritage */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Our Heritage
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  About IQ Trousers
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-neutral-300 hover:text-white transition-colors"
                >
                  Contact &amp; Factory Visits
                </Link>
              </li>
              <li>
                <span className="text-xs text-neutral-500">
                  Krish Clothing Co. — Engineered precision garments crafted for Indian comfort.
                </span>
              </li>
            </ul>
          </div>

          {/* Headquarters Info */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              Headquarters
            </h3>
            <div className="space-y-3 text-sm text-neutral-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-neutral-300 shrink-0 mt-1" />
                <p className="text-xs leading-relaxed">
                  <strong className="text-white block">Krish Clothing Co.</strong>
                  Plot 501-504, Textile Tower, Ring Road,<br />
                  Surat, Gujarat - 395002
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-neutral-300 shrink-0" />
                <span className="text-xs">+91 98250 13579</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-neutral-300 shrink-0" />
                <span className="text-xs">Mon - Sat: 10:00 AM - 7:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>
            © {new Date().getFullYear()} IQ Trousers • Krish Clothing Co. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-neutral-300 transition-colors">
              Terms &amp; Conditions
            </Link>
            <span>•</span>
            <Link href="/shipping-policy" className="hover:text-neutral-300 transition-colors">
              Wholesale Dispatch Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
