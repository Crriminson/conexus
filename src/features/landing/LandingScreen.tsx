import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { LandingWorkflow } from '@/components/landing/LandingWorkflow'
import { LandingFooter } from '@/components/landing/LandingFooter'

/**
 * Public entry route ('/'). Ported from the legacy Next.js app's
 * src/app/page.tsx (branch `user_landing_page_info`) rather than merged —
 * that branch is the entire pre-rebuild Next.js/Prisma application, and
 * merging it would reintroduce a second implementation of this product.
 * See docs/DECISIONS.md.
 *
 * Composition only, per CLAUDE.md's code-organization rules: the original
 * was a single 207-line file, over the ~200-line ceiling, so each band is
 * its own component in components/landing/.
 *
 * No loading/empty/error states: this screen reads no data. It is the one
 * route in the app with no hook, by design — a public page must render
 * before (and regardless of whether) Supabase is reachable.
 */
export function LandingScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingWorkflow />
      </main>
      <LandingFooter />
    </div>
  )
}
