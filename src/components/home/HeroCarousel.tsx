"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Layers,
  FilePlus,
  ShoppingBag,
} from "lucide-react";

interface Slide {
  id: string;
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}

const CAROUSEL_SLIDES: Slide[] = [
  {
    id: "everyday-casual",
    image: "/everyday-casual-hero.jpg",
    badge: "Everyday Living • Casuals",
    title: "Casual Everyday Trousers",
    subtitle: "Engineered with 0.5\" adaptive flex waistband and high-twist cotton for effortless all-day comfort.",
    ctaText: "Shop Everyday Casuals",
    ctaLink: "/products?category=EVERYDAY+CASUAL",
    secondaryCtaText: "Take Wholesale Order",
    secondaryCtaLink: "/orders/new",
  },
  {
    id: "formal-wear",
    image: "/formal-wear-hero.jpg",
    badge: "Executive Sartorial Collection",
    title: "Sharp Formal Trousers",
    subtitle: "Impeccable drape and crease-resistant structure tailored for executive boardrooms and formal evenings.",
    ctaText: "Shop Formal Wear",
    ctaLink: "/products?category=FORMAL+WEAR",
    secondaryCtaText: "View Catalog",
    secondaryCtaLink: "/products",
  },
  {
    id: "winter-collection",
    image: "/winter-collection-hero.jpg",
    badge: "Seasonal All-Weather Weave",
    title: "Premium Linen & Blends",
    subtitle: "Luxurious breathable textures crafted with precision stitching by Krish Clothing Co.",
    ctaText: "Shop Linen Collection",
    ctaLink: "/products?category=LINEN",
    secondaryCtaText: "Wholesale Order Form",
    secondaryCtaLink: "/orders/new",
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);

  const total = CAROUSEL_SLIDES.length;

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Autoplay
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
  };

  const slide = CAROUSEL_SLIDES[current];

  return (
    <div
      className="relative w-full overflow-hidden bg-neutral-950 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Aspect Ratio Container */}
      <div className="relative w-full h-[460px] sm:h-[540px] lg:h-[620px]">
        {CAROUSEL_SLIDES.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {/* Background Image */}
            <img
              src={s.image}
              alt={s.title}
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=1600";
              }}
            />

            {/* Dark Cinematic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent flex items-center">
              <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
                <div className="max-w-2xl space-y-4 text-white">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
                    <Sparkles size={14} className="text-orange-400" />
                    <span>{s.badge}</span>
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight drop-shadow-md">
                    {s.title}
                  </h1>

                  {/* Subtitle */}
                  <p className="text-sm sm:text-base lg:text-lg text-slate-200 leading-relaxed font-normal max-w-xl drop-shadow-sm">
                    {s.subtitle}
                  </p>

                  {/* CTAs */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Link
                      href={s.ctaLink}
                      className="inline-flex items-center gap-2 px-6 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 transition-all hover:scale-105 active:scale-95"
                    >
                      <span>{s.ctaText}</span>
                      <ArrowRight size={16} />
                    </Link>

                    <Link
                      href={s.secondaryCtaLink}
                      className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-xs sm:text-sm font-bold transition-all hover:bg-white/25"
                    >
                      <FilePlus size={16} className="text-orange-400" />
                      <span>{s.secondaryCtaText}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Navigation Arrows */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <ChevronRight size={22} />
        </button>

        {/* Indicators Dots */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
          {CAROUSEL_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === current
                  ? "w-8 bg-orange-500 shadow-md"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
