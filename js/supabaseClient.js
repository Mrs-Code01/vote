// Fill these in with your own Supabase project values:
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://lcqapwcmikyiwkuscslz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjcWFwd2NtaWt5aXdrdXNjc2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTE4OTcsImV4cCI6MjEwMzY4Nzg5N30.MLo5wgAqM0Twwz_xj4elbYsRmjfIrFa7nQCQvSdbBjQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes('YOUR-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');
}

function getDeviceId() {
  let id = localStorage.getItem('spectra_device_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    localStorage.setItem('spectra_device_id', id);
  }
  return id;
}
