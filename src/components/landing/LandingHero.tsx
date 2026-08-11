import { Link } from 'wouter'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

/**
 * The original hero faded in on mount via framer-motion. Dropped, not
 * ported: docs/DESIGN_SYSTEM.md's "Premium execution" rules prohibit
 * entrance animations outright ("Motion confirms an action happened — it
 * never decorates arrival"). That also removes the only reason to add
 * framer-motion as a dependency for two `motion.div`s.
 *
 * The primary CTA goes to /project/documents, which runs the real
 * useEnsureProject create-or-fetch — a first-time visitor lands on an
 * actual project, not a marketing dead end.
 */
export function LandingHero() {
  return (
    <section className="border-b border-hairline bg-paper px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl text-balance text-ink sm:text-5xl">
          Reimagining IPO documentation through intelligent compliance workflows.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-pretty text-ink-muted">
          Conexus turns the chaotic, document-heavy IPO preparation process into a clean, structured
          workflow — extraction you can audit, facts a human confirms, and a draft that cites its sources.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/project/documents" className={buttonVariants({ size: 'lg', className: 'h-12 px-8 text-base' })}>
            Open workspace
            <ArrowRight className="ml-2 size-4" />
          </Link>
          <a href="#features" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-12 px-8 text-base' })}>
            Learn more
          </a>
        </div>
      </div>
    </section>
  )
}
