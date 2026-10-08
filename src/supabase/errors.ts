interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
}

/** Turns a raw Postgrest/Storage/Auth error into a friendly, actionable message. */
export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  const err = error as SupabaseLikeError;
  const message = (err.message || '').toLowerCase();

  // Row Level Security rejection
  if (err.code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Permission denied. Sign in as an admin and try again.';
  }
  // Storage bucket missing/misconfigured
  if (message.includes('bucket not found')) {
    return 'Storage bucket "media" not found. Create it in Supabase → Storage (see supabase/schema.sql).';
  }
  if (message.includes('mime type') || message.includes('content-type not allowed')) {
    return 'That file type is not allowed by the storage bucket settings.';
  }
  if (message.includes('payload too large') || message.includes('exceeded the maximum allowed size')) {
    return 'That file is too large for the storage bucket\'s size limit.';
  }
  // Unique constraint violation
  if (err.code === '23505' || message.includes('duplicate key')) {
    return 'That item already exists (duplicate value).';
  }
  // Not authenticated / expired session
  if (message.includes('jwt') || message.includes('not authenticated') || err.status === 401) {
    return 'Session expired. Please sign in again at /admin/login.';
  }
  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }
  if (message.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  if (err.message) return err.message;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/** @deprecated Alias kept so existing call sites don't need renaming. Use getSupabaseErrorMessage. */
export const getFirebaseErrorMessage = getSupabaseErrorMessage;