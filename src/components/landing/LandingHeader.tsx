import { Link } from 'wouter'
import { Logo } from '@/components/layout/Logo'
import { buttonVariants } from '@/components/ui/button'

/**
 * Public header. Deliberately not `AppShell`'s header — that one carries the
 * project tab nav and the progress rail, neither of which exists before a
 * project does. Same Logo component and the same hairline-on-paper-raised
 * treatment, so the two read as one product rather than two.
 *
 * The original had a "Sign In" link to /login. This app has no auth (see
 * docs/ARCHITECTURE.md — the singleton-project model has no user concept),
 * so that link went nowhere; dropped rather than shipped as a dead end.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Logo />

        <nav className="hidden gap-6 md:flex">
          <a href="#features" className="text-sm font-medium text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            Features
          </a>
          <a href="#workflow" className="text-sm font-medium text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            Workflow
          </a>
        </nav>

        <Link href="/project/documents" className={buttonVariants({ size: 'lg' })}>
          Open workspace
        </Link>
      </div>
    </header>
  )
}
