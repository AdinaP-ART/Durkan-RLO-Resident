/* ============================================================
   supabase-client.js — Database connection
   Durkan Regen Resident App — Highbury Gardens
   Both values below are safe to be public — access is controlled
   by Row Level Security policies set up in the database itself.
============================================================ */
const SUPABASE_URL = 'https://xytdpmswnknxtwzawefh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J_Xh1xjHzD-WknJGsMHlRQ_uMuhXk9d';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
