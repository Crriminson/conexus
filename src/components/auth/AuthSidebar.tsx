"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ActivitySquare, Building2, Briefcase, Landmark, ShieldCheck } from "lucide-react";

const SLIDES = [
  {
    title: "Streamline your IPO journey.",
    description: "The intelligent platform for SMEs, Merchant Bankers, and Legal Advisors to collaborate, prepare, and validate IPO documentation seamlessly."
  },
  {
    title: "Accelerate due diligence.",
    description: "Automate compliance checks and securely manage sensitive financial documents with enterprise-grade encryption and access controls."
  },
  {
    title: "Collaborate seamlessly.",
    description: "Bring your entire IPO team together in one unified workspace. Track progress, assign tasks, and communicate in real-time."
  }
];

const TRUST_ICONS = [
  { Icon: Building2, color: "bg-blue-500" },
  { Icon: Landmark, color: "bg-purple-500" },
  { Icon: Briefcase, color: "bg-emerald-500" },
  { Icon: ShieldCheck, color: "bg-amber-500" }
];

export function AuthSidebar() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-900 text-white p-12 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-slate-900 pointer-events-none blur-3xl rounded-full" />
      
      <div className="relative z-10">
        <Link href="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ActivitySquare className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">CONEXUS</span>
        </Link>
      </div>
      
      <div className="relative z-10 max-w-lg">
        <div className="h-[280px] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
                {SLIDES[currentSlide].title}
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed mb-8">
                {SLIDES[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        <div className="flex items-center gap-2 mb-12 mt-4">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentSlide ? "w-8 bg-primary" : "w-2 bg-slate-700 hover:bg-slate-600"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-800 pt-8">
          <div className="flex -space-x-3">
            {TRUST_ICONS.map((item, i) => (
              <div 
                key={i} 
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 ${item.color} text-white shadow-sm z-[${4-i}]`}
              >
                <item.Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-4 h-4 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-400 mt-1">
              Trusted by 100+ IPO professionals
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
