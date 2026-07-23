"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ActivitySquare, Loader2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
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
      {/* Left Pane - Visuals */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-900 text-white p-12 relative overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-slate-900 pointer-events-none blur-3xl rounded-full" />
        
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ActivitySquare className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">CONEXUS</span>
          </Link>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
            Join the IPO ecosystem.
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed mb-8">
            Connect with experts, manage documentation seamlessly, and accelerate your path to becoming a public company.
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
        <div className="w-full max-w-[420px] space-y-8">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Mobile Logo */}
            <div className="lg:hidden flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-6">
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
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-100 flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-red-500">!</div>
              <p>{error}</p>
            </div>
          )}

          <form action={signup} className="space-y-6 mt-8">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jane Doe"
                  className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
                  required
                  minLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-700">Your Role</Label>
                <input type="hidden" name="role" value={role} />
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20">
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
              </div>
            </div>

            <SubmitButton />
          </form>
        </div>
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