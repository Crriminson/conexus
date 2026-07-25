'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/db';

// Maps form role values to Prisma ProjectRole enum
const ROLE_MAP: Record<string, 'APPLICANT_COMPANY' | 'MERCHANT_BANKER' | 'CHARTERED_ACCOUNTANT' | 'COMPANY_SECRETARY' | 'LEGAL_ADVISOR' | 'UNDERWRITER'> = {
  ApplicantCompany: 'APPLICANT_COMPANY',
  MerchantBanker: 'MERCHANT_BANKER',
  CharteredAccountant: 'CHARTERED_ACCOUNTANT',
  CompanySecretary: 'COMPANY_SECRETARY',
  LegalAdvisor: 'LEGAL_ADVISOR',
  Underwriter: 'UNDERWRITER',
};

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;

  // Validate role
  const prismaRole = ROLE_MAP[role];
  if (!prismaRole) {
    redirect(`/register?error=${encodeURIComponent('Invalid role selected')}`);
  }

  // 1. Create auth user in Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  // 2. Create matching User record in Prisma
  if (data.user) {
    try {
      await prisma.user.create({
        data: {
          id: data.user.id,
          email,
          name,
        },
      });
    } catch (dbError: any) {
      // If the user already exists in Prisma (e.g. re-registration attempt), ignore
      if (!dbError.message?.includes('Unique constraint')) {
        console.error('Failed to create user record:', dbError);
      }
    }
  }

  redirect('/login?message=Check your email to confirm your account');
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/forgot-password?message=Check your email for a password reset link');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
