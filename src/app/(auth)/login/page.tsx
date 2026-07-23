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
import { login } from "../actions";
import { createClient } from "@/utils/supabase/client";

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
        "Login"
      )}
    </Button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const handleGoogleLogin = async () => {
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
              <CardTitle className="text-2xl">Login to your account</CardTitle>
              <CardDescription>
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={login}>
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
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Link
                        href="/forgot-password"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-primary"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <Input id="password" name="password" type="password" required />
                  </Field>
                  <Field className="pt-4 space-y-4">
                    <SubmitButton />
                    <Button variant="outline" type="button" onClick={handleGoogleLogin} className="w-full h-11 transition-all">
                      Login with Google
                    </Button>
                    <FieldDescription className="text-center pt-2">
                      Don&apos;t have an account?{" "}
                      <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                        Sign up today
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}