import { Logo } from '@/components/layout/Logo'

/**
 * The original footer was slate-900 (near-black) with slate-400 text — a
 * consumer-SaaS convention that fights this product's paper/ink register,
 * and one the app itself uses nowhere. Rendered as a recessed paper panel
 * instead, which also lets the real <Logo/> sit here: that component draws
 * its wordmark as live ink-colored text, so it is invisible on a dark
 * ground. Using it in both header and footer is what makes the logo a
 * single source of truth rather than a PNG copy that drifts.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-hairline bg-paper-recessed px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
        <Logo />
        <p className="text-sm text-ink-muted">
          © {new Date().getFullYear()} Conexus Platform. All rights reserved.
        </p>
        <p className="text-sm text-ink-muted">Prototype — not a filing tool of record.</p>
      </div>
    </footer>
  )
}
