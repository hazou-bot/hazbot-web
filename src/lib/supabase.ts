// Minimal Supabase client for hazbot-web. Unlike hazbot-mobile's client (see
// hazbot-mobile/src/lib/supabase.ts), this app otherwise runs entirely on
// local mock data (see src/api/index.ts) with mock AsyncStorage-backed
// auth — this file exists solely so the public listing page
// (src/app/listing/[token].tsx) can call the anon-callable get_public_unit
// RPC against hazbot-mobile's real Supabase project, the one that actually
// owns the units/share-token schema. Nothing else in this app should import
// this — nothing else here talks to a real backend.
import 'react-native-url-polyfill/auto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True once EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set in .env — see
 * .env.example. The public listing page falls back to a friendly
 * "not available" state when this is false instead of crashing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — ' +
      'the public listing page (/listing/[token]) will show as unavailable. Copy ' +
      '.env.example to .env and fill in hazbot-mobile\'s Supabase project values.'
  );
}

// expo-router's static web export server-renders routes in a plain Node.js
// process to produce the initial HTML shell — no `window`, no browser.
// Supabase's GoTrueClient touches window.localStorage the instant
// persistSession is true, which throws "window is not defined" and crashes
// the export/dev server, not just this one request (see hazbot-mobile's
// lib/supabase.ts for the same issue). There's no sign-in flow here at all
// (anon RPC only), so session persistence is simply off — sidesteps the
// problem entirely instead of needing a `typeof window` guard.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
