"use client";
import { usePathname, useRouter } from "next/navigation";

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Loader2, Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useMutation } from "@tanstack/react-query"

const projectSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters" }),
  industry: z.string().min(2, { message: "Please select an industry" }),
  incorporationYear: z.coerce.number().min(1800).max(new Date().getFullYear()),
  companyType: z.string().min(2),
  registeredOffice: z.string().min(5),
  promoterDetails: z.string().optional(),
  financialYear: z.string().min(4),
})

type ProjectFormValues = z.infer<typeof projectSchema>

export default function NewProjectPage() {
  const _ = usePathname();
  const router = useRouter();
  const setLocation = (path) => router.push(path)
  const { toast } = useToast()
  
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      companyName: "",
      industry: "",
      incorporationYear: new Date().getFullYear(),
      companyType: "Private Limited",
      registeredOffice: "",
      promoterDetails: "",
      financialYear: "April - March",
    },
  })

  const createProject = useMutation({
    mutationFn: async ({ data }: { data: ProjectFormValues }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create project");
      }
      return res.json();
    }
  })

  function onSubmit(data: ProjectFormValues) {
    createProject.mutate({ data }, {
      onSuccess: (newProject) => {
        toast({
          title: "Project Created",
          description: "Starting eligibility assessment workflow.",
        })
        // Go straight to the first step of the workflow
        setLocation(`/projects/${newProject.project.id}/eligibility`)
      },
      onError: (error) => {
        toast({
          title: "Creation failed",
          description: error.message || "Could not create project",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">New IPO Project</h1>
          <p className="text-slate-500 mt-1">Initialize a new workspace for IPO preparation.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Details
          </CardTitle>
          <CardDescription>
            Enter the basic corporate information to set up the project context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Technologies Pvt Ltd" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry / Sector</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Technology">Technology & Software</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Healthcare">Healthcare & Pharma</SelectItem>
                          <SelectItem value="Finance">Financial Services</SelectItem>
                          <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                          <SelectItem value="Energy">Energy & Utilities</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Private Limited">Private Limited</SelectItem>
                          <SelectItem value="Public Limited">Public Limited (Unlisted)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Must be converted to Public Limited before filing.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incorporationYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Incorporation</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="registeredOffice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered Office Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Full registered address as per MCA/records" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="promoterDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Promoters (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Names of key promoters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="financialYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financial Year Cycle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cycle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="April - March">April - March</SelectItem>
                          <SelectItem value="January - December">January - December</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 flex justify-end gap-4 border-t">
                <Button variant="outline" type="button" onClick={() => setLocation("/projects")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Continue to Eligibility
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}