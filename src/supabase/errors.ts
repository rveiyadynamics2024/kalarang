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
