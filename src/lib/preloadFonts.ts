import publicSansLatin from '@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2?url'
import caslonLatin from '@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff2?url'

// The two above-the-fold faces only (docs/DESIGN_SYSTEM.md, "Performance") —
// Public Sans (body text on every screen) and Libre Caslon Display (every
// h1/h2/h3). IBM Plex Mono (citation/data values) is never needed for first
// paint, so it isn't preloaded.
const ABOVE_FOLD_FONTS = [publicSansLatin, caslonLatin]

export function preloadAboveFoldFonts() {
  for (const href of ABOVE_FOLD_FONTS) {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
}
