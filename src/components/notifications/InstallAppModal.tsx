"use client";

import React, { useState } from "react";
import { X, Share, PlusSquare, Smartphone, Tablet, CheckCircle2, Bell, Sparkles } from "lucide-react";
import { useNotifications } from "./NotificationProvider";

export default function InstallAppModal() {
  const { isInstallGuideOpen, setIsInstallGuideOpen, requestPermission, permission } = useNotifications();
  const [deviceTab, setDeviceTab] = useState<"iphone" | "android">("iphone");

  if (!isInstallGuideOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with App Logo */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-[#162082] to-[#0a1147] text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md flex items-center justify-center">
              <img
                src="/apple-touch-icon.png"
                alt="OBEXA"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Save OBEXA WebApp on Your Phone
              </h3>
              <p className="text-xs text-blue-200">
                Install as a full native web app on iPhone, iPad &amp; Android
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsInstallGuideOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (iPhone / iPad vs Android / Tablet) */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setDeviceTab("iphone")}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              deviceTab === "iphone"
                ? "bg-white text-[#162082] shadow-xs border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>iPhone &amp; iPad (iOS)</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceTab("android")}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              deviceTab === "android"
                ? "bg-white text-[#162082] shadow-xs border border-gray-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Android &amp; Tablets</span>
          </button>
        </div>

        {/* Instructions Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-gray-700">
          {deviceTab === "iphone" ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#162082] shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed font-medium">
                  Saving on your iPhone home screen opens OBEXA in <strong>full-screen standalone mode</strong> (without Safari address bars) with your custom logo as the app icon!
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#162082] text-white text-xs font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                      Open this website in Safari on your iPhone or iPad
                    </p>
                    <p className="text-xs text-gray-500">
                      (Must be opened via Safari to install to iOS Home Screen)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#162082] text-white text-xs font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                      <span>Tap the <strong>Share</strong> button at bottom center</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs text-gray-800">
                        <Share className="w-3.5 h-3.5 text-blue-600" /> Share
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Located in the bottom Safari toolbar (or top right on iPad).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#162082] text-white text-xs font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                      <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs text-gray-800">
                        <PlusSquare className="w-3.5 h-3.5 text-gray-800" /> Add to Home Screen
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      The OBEXA logo icon will automatically show as the app face.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#162082] text-white text-xs font-black flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                      Tap <strong>Add</strong> in the top-right corner
                    </p>
                    <p className="text-xs text-gray-500">
                      The OBEXA webapp will instantly appear on your iPhone home screen!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  On Android and Tablets, you can install the website directly from Chrome or Samsung Internet with offline caching and live notifications!
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                      Open website in Google Chrome
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                      Tap the 3 dots (⋮) menu in top-right corner
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                      Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enable Notifications Call to Action */}
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            {permission !== "granted" ? (
              <button
                type="button"
                onClick={requestPermission}
                className="w-full py-2.5 px-4 bg-[#162082] hover:bg-[#0f175c] text-white rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
              >
                <Bell className="w-4 h-4" />
                <span>Enable Live iPhone Alerts (New Articles &amp; Orders)</span>
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Live push &amp; lock-screen alerts are enabled!</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={() => setIsInstallGuideOpen(false)}
            className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
