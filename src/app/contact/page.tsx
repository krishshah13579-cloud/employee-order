"use client";

import { useState } from "react";
import { MapPin, Mail, Phone, Clock, CheckCircle2, Send, Loader2 } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-600">
            Get In Touch
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-neutral-900 tracking-tight mt-2">
            Contact | IQ Trousers
          </h1>
          <p className="text-neutral-500 text-sm sm:text-base mt-3 leading-relaxed">
            Have questions about wholesale supply, dealership inquiries, or bulk orders? Our team at Krish Clothing Co. is here to assist you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Contact Details & Address */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-200 space-y-6">
              <h2 className="text-xl font-bold text-neutral-900 border-b border-neutral-200 pb-4">
                Headquarters &amp; Dispatch
              </h2>

              <div className="flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-orange-600 shrink-0 mt-1" />
                <div className="text-sm text-neutral-700 leading-relaxed">
                  <p className="font-bold text-neutral-900">Krish Clothing Co.</p>
                  <p>Plot 501-504, Textile Tower, Ring Road,</p>
                  <p>Surat - 395002, Gujarat, India</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Mail className="w-5 h-5 text-orange-600 shrink-0" />
                <div className="text-sm text-neutral-700">
                  <p className="font-bold text-neutral-900">Email Inquiries</p>
                  <p className="text-xs text-neutral-500 font-mono">orders@iqtrousers.com</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Phone className="w-5 h-5 text-orange-600 shrink-0" />
                <div className="text-sm text-neutral-700">
                  <p className="font-bold text-neutral-900">Direct Client Line</p>
                  <p className="text-xs text-neutral-500">+91 98250 13579</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Clock className="w-5 h-5 text-orange-600 shrink-0" />
                <div className="text-sm text-neutral-700">
                  <p className="font-bold text-neutral-900">Factory Working Hours</p>
                  <p className="text-xs text-neutral-500">
                    Mon - Sat, 10:00 AM - 7:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7">
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-neutral-200 shadow-sm">
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                Send Us a Message
              </h2>
              <p className="text-xs text-neutral-500 mb-6">
                Fill out the form below and an IQ Trousers representative will get back to you promptly.
              </p>

              {submitted ? (
                <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h3 className="text-lg font-bold text-neutral-900">
                    Message Received
                  </h3>
                  <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                    Thank you for reaching out. A client manager from Krish Clothing Co. will contact you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setName("");
                      setEmail("");
                      setPhone("");
                      setSubject("");
                      setMessage("");
                    }}
                    className="mt-4 px-5 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        Your Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh Shah"
                        className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-neutral-700 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 98250 12345"
                        className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Wholesale Dealership / Bulk Trouser Supply"
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-700 mb-1">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your inquiry or order requirements..."
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-8 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
