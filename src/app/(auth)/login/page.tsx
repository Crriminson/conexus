"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ActivitySquare, Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { login } from "../actions";
import { useFormStatus } from "react-dom";
import { Suspense, useState } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full h-11 text-base font-medium transition-all" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Left Pane - Visuals */}
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
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
            Streamline your IPO journey.
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed mb-8">
            The intelligent platform for SMEs, Merchant Bankers, and Legal Advisors to collaborate, prepare, and validate IPO documentation seamlessly.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-slate-900 bg-slate-800" />
              ))}
            </div>
            <p className="text-sm font-medium text-slate-400">
              Trusted by 100+ IPO professionals
            </p>
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 py-12 sm:px-6 lg:px-8">
        <motion.div 
          className="w-full max-w-[420px] space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="lg:hidden flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6 shadow-lg shadow-primary/20">
              <ActivitySquare className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign up today
              </Link>
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-100 flex items-start gap-3"
            >
              <div className="mt-0.5 h-4 w-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-red-500">!</div>
              <p>{error}</p>
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl bg-green-50 p-4 text-sm text-green-700 border border-green-100 flex items-start gap-3"
            >
              <div className="mt-0.5 h-4 w-4 rounded-full bg-green-100 border border-green-200 flex items-center justify-center shrink-0 text-green-500">✓</div>
              <p>{message}</p>
            </motion.div>
          )}

          <form action={login} className="space-y-6 mt-8">
            <div className="space-y-5">
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/20 transition-all hover:bg-slate-50"
                  required
                />
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <div className="relative group">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/20 pr-10 transition-all hover:bg-slate-50 group-hover:border-slate-300"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </motion.div>
            </div>

            <motion.div 
              className="flex items-center justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center space-x-2">
                <Checkbox id="rememberMe" name="rememberMe" className="border-slate-300 data-[state=checked]:bg-primary" />
                <Label htmlFor="rememberMe" className="text-sm font-medium text-slate-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  Remember me
                </Label>
              </div>

              <div className="text-sm">
                <Link href="/forgot-password" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <SubmitButton />
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}