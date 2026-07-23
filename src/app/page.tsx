"use client";
import Link from "next/link";

import { motion } from "framer-motion"
import { ActivitySquare, ArrowRight, ShieldCheck, FileText, CheckCircle, Upload, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <ActivitySquare className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">CONEXUS</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</a>
            <a href="#workflow" className="text-sm font-medium text-muted-foreground hover:text-foreground">Workflow</a>
            <a href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-foreground">Why Conexus</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-slate-50 py-24 sm:py-32">
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl"
            >
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Reimagining IPO Documentation Through Intelligent Compliance Workflows.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Conexus turns the chaotic, document-heavy IPO preparation process into a clean, structured workflow. Enterprise-grade regulatory technology built for modern merchant bankers and companies.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/register">
                  <Button size="lg" className="h-12 px-8 text-base">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-transparent">
                    Learn More
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white">
          <div className="container px-4 mx-auto sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-primary">Everything you need</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Command center for IPO readiness
              </p>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                A purpose-built platform that handles the complexity of regulatory compliance while keeping humans in control.
              </p>
            </div>
            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                <div className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-slate-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Layers className="h-6 w-6 text-primary" />
                    </div>
                    Structured Knowledge Base
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-slate-600">
                    Centralize company data, financials, and legal information in a structured format rather than scattered documents.
                  </dd>
                </div>
                <div className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-slate-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    Live Document Generation
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-slate-600">
                    See your Offer Document take shape in real-time as you complete structured forms. No more formatting nightmares.
                  </dd>
                </div>
                <div className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-slate-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    Automated Validation
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-slate-600">
                    Run comprehensive checks against regulatory requirements to catch missing fields, data inconsistencies, and compliance gaps early.
                  </dd>
                </div>
                <div className="relative pl-16">
                  <dt className="text-base font-semibold leading-7 text-slate-900">
                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ActivitySquare className="h-6 w-6 text-primary" />
                    </div>
                    Readiness Tracking
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-slate-600">
                    Know exactly where you stand with precise completion scores, pending gap tracking, and clear milestones.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-24 bg-slate-50">
          <div className="container px-4 mx-auto sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                The Conexus Workflow
              </h2>
            </div>
            
            <div className="mx-auto max-w-5xl">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">1. Eligibility</h3>
                  <p className="text-sm text-slate-600">Assess exchange requirements and financial thresholds upfront.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">2. Data Extraction</h3>
                  <p className="text-sm text-slate-600">Upload source documents and populate the structured knowledge base.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">3. Drafting</h3>
                  <p className="text-sm text-slate-600">Collaboratively draft document sections with live preview.</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">4. Validation</h3>
                  <p className="text-sm text-slate-600">Run compliance checks, resolve gaps, and finalize for review.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-slate-900 py-12 text-slate-400">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ActivitySquare className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight text-white">CONEXUS</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} Conexus Platform. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}