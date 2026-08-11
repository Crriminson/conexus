/**
 * Mark + wordmark, composed in code rather than baked into one image.
 *
 * The old asset baked "CONEXUS" into the SVG using Inter (a face this app
 * never actually loads) with hand-tuned letter-spacing — an <img> can't
 * inherit the page's real fonts, so the wordmark always rendered off from
 * the rest of the UI. It also turned out the bull-on-bars graphic itself
 * (the original hand-authored SVG path data) was a rough approximation of
 * the actual brand mark, not a faithful copy — replaced with a crop of the
 * real source artwork (`public/conexus-mark.png`), background keyed to
 * transparent, sized for crisp display well above the header's actual
 * render size rather than upscaled. The wordmark stays live text in Public
 * Sans, spaced with a real Tailwind tracking step instead of a per-letter
 * baked value; the "X" keeps the brand's teal-to-navy gradient (the same
 * two colors as the mark's bar/arrow gradient), the one place this
 * wordmark isn't flat ink.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <img src="/conexus-mark.png" alt="" className="h-8 w-auto" />
      <span className="font-sans text-xl font-black tracking-tighter text-ink">
        CONE
        <span className="bg-gradient-to-br from-[#17c0a9] to-[#0c3d72] bg-clip-text text-transparent">X</span>
        US
      </span>
    </div>
  )
}
