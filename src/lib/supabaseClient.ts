import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect whether actual live Supabase credentials have been configured
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
    !supabaseUrl.includes('placeholder.supabase.co') &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );
};

// Singleton client instance
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Generate a short-lived cryptographic signed URL for private medical document downloads.
 * Expires by default in 300 seconds (5 minutes).
 */
export async function getSignedDocumentUrl(
  storagePath: string, 
  expiresInSeconds: number = 300
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) {
    return { 
      url: null, 
      error: 'Supabase client is running in local demonstration mode. Live signed storage URLs require configured credentials.' 
    };
  }

  try {
    const { data, error } = await supabase.storage
      .from('medical-documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl, error: null };
  } catch (err: unknown) {
    return { 
      url: null, 
      error: err instanceof Error ? err.message : 'Unknown storage error' 
    };
  }
}

/**
 * Validates document ownership against the current authenticated user id
 */
export async function verifyDocumentOwnership(documentId: string): Promise<boolean> {
  if (!supabase) return true; // Local demo mode assumes valid ownership

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('profile_id', user.id)
    .single();

  if (error || !data) return false;
  return true;
}
