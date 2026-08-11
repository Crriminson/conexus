/**
 * Mark + wordmark, composed in code rather than baked into one image.
 *
 * The old asset baked "CONEXUS" into the SVG using Inter (a face this app
 * never actually loads) with hand-tuned letter-spacing — an <img> can't
 * inherit the page's real fonts, so the wordmark always rendered off from
 * the rest of the UI. The bull-on-bars graphic (`public/conexus-mark.svg`,
 * cropped from the original asset to just that mark) stays an image; the
 * wordmark is live text in Public Sans, spaced with a real Tailwind
 * tracking step instead of a per-letter baked value.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <img src="/conexus-mark.svg" alt="" className="h-8 w-auto" />
      <span className="font-sans text-xl font-black tracking-tighter text-ink">CONEXUS</span>
    </div>
  )
}
