import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Placeholder credentials (User will replace with actual Supabase Keys)
export const SUPABASE_URL = 'https://ortfjwvecawppshfxjbn.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydGZqd3ZlY2F3cHBzaGZ4amJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MjQ4NTUsImV4cCI6MjEwMjMwMDg1NX0.xORT5OEVXPGVLA0sxmH427ivy67tNU4ztoWjZqp6g7I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
