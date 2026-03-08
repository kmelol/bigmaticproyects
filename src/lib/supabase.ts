/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This client is prepared for future migration to Supabase.
// Currently, the app uses the local SQLite database via the Express server.
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

/**
 * Migration Guide:
 * 1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
 * 2. Create 'projects' and 'tasks' tables in Supabase matching the SQLite schema.
 * 3. Update the API calls in ProjectList.tsx and ProjectDetail.tsx to use this client
 *    instead of fetching from /api/*.
 */
