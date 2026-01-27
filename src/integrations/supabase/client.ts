import { createClient } from '@supabase/supabase-js';

// Support both VITE_ and NEXT_PUBLIC_ prefixes for Vercel compatibility
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
    || "https://jdwqrsyesaxfvxdcpkbb.supabase.co";

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkd3Fyc3llc2F4ZnZ4ZGNwa2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNzI4NTMsImV4cCI6MjA2Nzc0ODg1M30.iw-et0rQ3bTCajT73kXRCspq5MpsSCQtOz7A1u49Zrs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
    }
});
