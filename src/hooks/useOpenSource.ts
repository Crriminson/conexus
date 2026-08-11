import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET

/**
 * Opens the source document at the page a fact was extracted from.
 *
 * The bucket is private, so a short-lived signed URL is minted per click
 * rather than storing a public link. `#page=N` is the PDF open-parameter
 * every major in-browser viewer honours; if a viewer ignores it the document
 * still opens, just at page 1.
 */
export function useOpenSource() {
  return useCallback(async (storagePath: string, page: number | null) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300)
    if (error || !data) throw error ?? new Error('Could not create signed URL')

    const url = page ? `${data.signedUrl}#page=${page}` : data.signedUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])
}
