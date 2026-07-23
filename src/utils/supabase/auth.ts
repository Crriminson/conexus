import { createClient } from '@/utils/supabase/server';
import { User } from '@supabase/supabase-js';

/**
 * Checks for a valid Supabase session.
 * Throws an error if unauthorized, allowing API routes to stay clean.
 * 
 * @returns The authenticated Supabase User object
 */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  return user;
}
