import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { Database } from '$lib/types/database';

// Get environment variables with fallbacks for development
// In production, these MUST be set in your .env file
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured && isBrowser) {
  console.warn(
    '⚠️ Supabase is not configured. Create a .env file with:\n' +
    'VITE_SUPABASE_URL=your-supabase-url\n' +
    'VITE_SUPABASE_ANON_KEY=your-anon-key\n\n' +
    'Get these from: https://supabase.com/dashboard/project/_/settings/api'
  );
}

/**
 * Create Supabase client for browser usage
 */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    // Return a mock client that won't crash but won't work
    return createMockClient();
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Create a mock client for when Supabase isn't configured
 * This prevents crashes during development without credentials
 */
function createMockClient(): any {
  const mockResponse = { data: null, error: { message: 'Supabase not configured' } };
  const mockBuilder: any = {
    select: () => mockBuilder,
    insert: () => mockBuilder,
    update: () => mockBuilder,
    delete: () => mockBuilder,
    eq: () => mockBuilder,
    neq: () => mockBuilder,
    or: () => mockBuilder,
    order: () => mockBuilder,
    limit: () => mockBuilder,
    single: () => Promise.resolve(mockResponse),
    then: (resolve: any) => resolve(mockResponse),
  };
  
  return {
    from: () => mockBuilder,
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {},
      unsubscribe: () => {},
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
}

/**
 * Create Supabase client for server-side usage (load functions, actions)
 */
export function createSupabaseServerClient(
  cookies: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string, options: any) => void;
    remove: (key: string, options: any) => void;
  }
) {
  if (!isSupabaseConfigured) {
    return createMockClient();
  }
  
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return cookies.get(key);
        },
        set(key, value, options) {
          cookies.set(key, value, { ...options, path: '/' });
        },
        remove(key, options) {
          cookies.remove(key, { ...options, path: '/' });
        },
      },
    }
  );
}

/**
 * Get or create anonymous session ID
 * Stored in sessionStorage for anonymous vote tracking
 */
export function getSessionId(): string {
  if (!isBrowser) {
    return crypto.randomUUID();
  }
  
  const STORAGE_KEY = 'knowledge-arena-session';
  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Supabase singleton for client-side usage
 */
let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function getSupabase() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
