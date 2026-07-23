"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { AuthSidebar } from "@/components/auth/AuthSidebar";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signup } from "../actions";
import { createClient } from "@/utils/supabase/client";

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

  const handleGoogleSignup = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex min-h-screen">
      <AuthSidebar />

      {/* Right Pane - Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-10 bg-slate-50/50">
        <motion.div 
          className="w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create an account</CardTitle>
              <CardDescription>
                Enter your details below to register
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signup}>
                <FieldGroup>
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

                  <Field>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Jane Doe"
                      required
                      minLength={2}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="role">Your Role</FieldLabel>
                    <input type="hidden" name="role" value={role} />
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
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
                  </Field>

                  <Field className="pt-4 space-y-4">
                    <SubmitButton />
                    <Button variant="outline" type="button" onClick={handleGoogleSignup} className="w-full h-11 transition-all">
                      Sign up with Google
                    </Button>
                    <FieldDescription className="text-center pt-2">
                      Already have an account?{" "}
                      <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                        Sign in
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
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