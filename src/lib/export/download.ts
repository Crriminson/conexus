// Thin browser-API wrapper — triggers a file save via a throwaway object
// URL and anchor click. Not unit tested for the same reason useOpenSource
// isn't: it's a one-line DOM call, not logic (see src/hooks/useOpenSource.ts).
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}
