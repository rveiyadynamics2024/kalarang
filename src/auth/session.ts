import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/config';
import { ADMIN_EMAIL, isAdminEmail } from './constants';

export function subscribeToAuth(onChange: (user: User | null) => void): () => void {
  // Fire once immediately with whatever session is already persisted...
  supabase.auth.getSession().then(({ data }) => onChange(data.session?.user ?? null));

  // ...then keep listening for sign-in / sign-out / token refresh.
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session?.user ?? null);
  });

  return () => listener.subscription.unsubscribe();
}

export function isAdminUser(user: User | null): boolean {
  return isAdminEmail(user?.email ?? null);
}

export async function waitForAuthReady(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

async function finalizeSession(user: User): Promise<User> {
  if (!isAdminEmail(user.email)) {
    await supabase.auth.signOut();
    throw new Error('Only authorized admin emails can access the admin panel.');
  }
  return user;
}

/**
 * Admin login using Supabase Auth directly from the browser — no server
 * function needed, so this works on any static host (Vercel, Firebase
 * Hosting, GitHub Pages, Cloudflare Pages, S3, your own server, etc.).
 *
 * The admin user must already exist in Supabase Auth (Dashboard →
 * Authentication → Users → Add user) with one of the emails in ADMIN_EMAILS.
 */
export async function loginAdmin(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !data.user) {
    throw error || new Error('Login failed. Check your email and password.');
  }

  return finalizeSession(data.user);
}

export async function logoutAdmin(): Promise<void> {
  await supabase.auth.signOut();
}

export async function ensureAdminAuth(): Promise<User> {
  const user = await waitForAuthReady();

  if (!user) {
    throw new Error('You are not signed in. Please log in at /admin/login and try again.');
  }

  if (!isAdminUser(user)) {
    throw new Error(`Only ${ADMIN_EMAIL} can perform admin uploads and edits.`);
  }

  return user;
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const err = error as { message?: string; status?: number } | undefined;
  const message = (err?.message || '').toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password. Use your Supabase Auth credentials for this admin email.';
  }
  if (message.includes('email not confirmed')) {
    return 'This admin account has not confirmed its email yet. Confirm it in Supabase → Authentication → Users, or disable email confirmation for this project.';
  }
  if (message.includes('too many requests') || err?.status === 429) {
    return 'Too many failed attempts. Please wait a few minutes and try again.';
  }
  if (message.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  if (message.includes('only') && message.includes('admin')) {
    return err!.message!;
  }

  return error instanceof Error ? error.message || fallback : fallback;
}
