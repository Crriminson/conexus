import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useEnsureProject() {
  return useQuery({
    queryKey: ['project', 'singleton'],
    queryFn: async () => {
      const { data: existing, error: fetchError } = await supabase
        .from('projects')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (existing) return existing.id as string

      const { data: created, error: insertError } = await supabase
        .from('projects')
        .insert({ name: 'Demo Issuer' })
        .select('id')
        .single()

      if (insertError) throw insertError
      return created.id as string
    },
  })
}
