import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Create a separate client for registration that DOES NOT persist session.
// This prevents Supabase from automatically logging out the admin when a new user is created.
export const registerClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
