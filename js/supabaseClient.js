// Fill these in with your own Supabase project values:
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://lcqapwcmikyiwkuscslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjcWFwd2NtaWt5aXdrdXNjc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTE4OTcsImV4cCI6MjEwMzY4Nzg5N30.MLo5wgAqM0Twwz_xj4elbYsRmjfIrFa7nQCQvSdbBjQ';

// Optional: restrict voting to your company's email domain(s).
// Leave the array empty to allow any email address.
// Example: ['spectra.com', 'spectragroup.com']
//
// IMPORTANT: this list is a convenience check in the browser. To make it
// binding, also uncomment the matching policy at the bottom of
// supabase/schema.sql so the database enforces it too.
const ALLOWED_EMAIL_DOMAINS = [];

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');
}

function isEmailDomainAllowed(email) {
  if (!ALLOWED_EMAIL_DOMAINS.length) return true;
  const domain = String(email).split('@')[1]?.toLowerCase().trim();
  return ALLOWED_EMAIL_DOMAINS.some(d => d.toLowerCase().trim() === domain);
}
