"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ActivitySquare, Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { AuthSidebar } from "@/components/auth/AuthSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signup } from "../actions";
import { useFormStatus } from "react-dom";
import { Suspense, useState } from "react";

const ROLES = [
  { value: "ApplicantCompany", label: "Applicant Company" },
  { value: "MerchantBanker", label: "Merchant Banker" },
  { value: "CharteredAccountant", label: "Chartered Accountant" },
  { value: "CompanySecretary", label: "Company Secretary" },
  { value: "LegalAdvisor", label: "Legal Advisor" },
  { value: "Underwriter", label: "Underwriter" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full h-11 text-base font-medium transition-all" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Creating account...
        </>
      ) : (
        "Create account"
      )}
    </Button>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [role, setRole] = useState("ApplicantCompany");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AuthSidebar />

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
              Create an account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign in
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

          <form action={signup} className="space-y-6 mt-8">
            <div className="space-y-5">
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jane Doe"
                  className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/20 transition-all hover:bg-slate-50"
                  required
                  minLength={2}
                />
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
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
                transition={{ delay: 0.3 }}
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
                    minLength={8}
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

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Label htmlFor="role" className="text-slate-700 font-medium">Your Role</Label>
                <input type="hidden" name="role" value={role} />
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/20 transition-all hover:bg-slate-50">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <SubmitButton />
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}