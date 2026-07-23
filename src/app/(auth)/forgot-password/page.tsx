"use client";
import { useState } from "react"
import Link from "next/link";

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ActivitySquare, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  function onSubmit(data: ForgotPasswordFormValues) {
    // Mock submit
    console.log("Password reset requested for", data.email)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
            <MailCheck className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Check your email</h2>
          <p className="text-slate-600">
            We've sent a password reset link to <span className="font-medium text-slate-900">{form.getValues().email}</span>.
          </p>
          <div className="pt-6">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Return to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4">
            <ActivitySquare className="h-8 w-8" />
          </div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-8">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-11">
              Send reset link
            </Button>
            
            <div className="text-center pt-2">
              <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Back to login
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}