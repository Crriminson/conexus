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

/**
 * Checks for a valid Supabase session AND ensures the user is a member of the project.
 * Throws an error if unauthorized or forbidden.
 * 
 * @param projectId The ID of the project to check access against
 * @returns The authenticated Supabase User object
 */
export async function requireProjectAuth(projectId: string): Promise<User> {
  const user = await requireAuth();

  const { prisma } = await import('@/db');
  const membership = await prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId,
      },
    },
  });

  if (!membership) {
    throw new Error('Forbidden: You do not have access to this project');
  }

  return user;
}
