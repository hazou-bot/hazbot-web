// Public, UNAUTHENTICATED listing page — the landing page behind a "Share
// listing" link generated in hazbot-mobile's unit detail modal (see
// unitDetailModal.tsx's shareListing()). No sign-in, no session, no app nav
// chrome: this route is registered with headerShown:false in _layout.tsx and
// never touches useSession(), so it never gets pulled into the
// welcome/login/paywall funnel the rest of the app's screens do (see
// auth/routing.ts's pendingAuthRoute, which this page deliberately never
// calls). Resolves the token via the anon-callable get_public_unit(p_token)
// RPC in hazbot-mobile's Supabase project (see src/lib/supabase.ts) — a
// narrow, safe column set only, never the full unit record.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pill } from '../../components/pill';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { cardShadow, radius, useTheme } from '../../theme';
import { UnitStatus } from '../../types';

// Deliberately NOT the full Unit type from ../../types — that carries tenant
// contact info, access codes, and other fields a public page must never be
// able to request. This mirrors exactly (and only) the column list
// get_public_unit() returns: id, building, address, neighborhood, unit,
// status, gross_rent, beds, baths, available_from, street_easy_url.
interface PublicUnit {
  id: string;
  building: string;
  address: string;
  neighborhood: string;
  unit: string;
  status: UnitStatus;
  gross_rent: number;
  beds: number;
  baths: number;
  available_from: string; // ISO date
  street_easy_url: string | null;
}

const STATUS_LABEL: Record<UnitStatus, string> = {
  available: 'Available',
  pending: 'Pending',
  taken: 'Taken',
};

function statusColor(status: UnitStatus, colors: ReturnType<typeof useTheme>): string {
  if (status === 'available') return colors.teal;
  if (status === 'pending') return colors.amber;
  return colors.danger;
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

// "106 Grattan St 3F" -> "106 Grattan St #3F" — same convention as
// hazbot-mobile's unitLabel() in components/unitDetailModal.tsx.
function unitLabel(u: PublicUnit): string {
  if (!u.unit) return u.address;
  return u.unit.includes(' ') ? `${u.address} ${u.unit}` : `${u.address} #${u.unit}`;
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

// Also reachable as /listing/<token> (this file's own route) when hosted at
// a domain root, or via a ?token= query param on the app's bare root path
// (see _layout.tsx's PublicRouteGate) when hosted under a GitHub-Pages-style
// project subpath — expo-router's client-side path matching doesn't strip a
// subpath prefix the way the static HTML export's own asset URLs do (tried
// app.json's experiments.baseUrl, confirmed it has no effect on this SDK's
// static web export), so a query param on the one path that's guaranteed to
// resolve (the root) sidesteps the whole problem instead of fighting it.
export default function PublicListingScreen({ token: tokenProp }: { token?: string } = {}) {
  const params = useLocalSearchParams<{ token: string }>();
  const token = tokenProp ?? params.token;
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>('loading');
  const [unit, setUnit] = useState<PublicUnit | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setState('not-found');
        return;
      }
      if (!isSupabaseConfigured || !supabase) {
        setState('error');
        return;
      }
      const { data, error } = await supabase.rpc('get_public_unit', { p_token: token });
      if (cancelled) return;
      if (error) {
        setState('error');
        return;
      }
      // Postgres functions returning `setof`/table shapes come back as an
      // array from PostgREST even when at most one row can ever match a
      // unique token; a plain scalar-row function would come back as a
      // single object instead — handle both shapes defensively.
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setState('not-found');
        return;
      }
      setUnit(row as PublicUnit);
      setState('ready');
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (state === 'not-found' || state === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <View style={[styles.badge, { backgroundColor: colors.tealSoft }]}>
          <Ionicons name="home-outline" size={26} color={colors.teal} />
        </View>
        <Text style={[styles.notFoundTitle, { color: colors.text }]}>
          {state === 'error' ? 'Something went wrong' : "This listing isn't available"}
        </Text>
        <Text style={[styles.notFoundBody, { color: colors.subtext }]}>
          {state === 'error'
            ? "We couldn't load this listing right now. Try the link again in a moment."
            : 'This link may have expired, or the agent has taken this listing down.'}
        </Text>
      </View>
    );
  }

  const u = unit!;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.banner, cardShadow, { backgroundColor: colors.teal }]}>
        <Text style={[styles.bannerName, { color: colors.onTeal }]}>{unitLabel(u)}</Text>
        <Text style={[styles.bannerSubtitle, { color: colors.onTeal }]}>
          {u.building} · {u.neighborhood}
        </Text>
        <View style={styles.pillWrap}>
          <Pill label={STATUS_LABEL[u.status]} color={statusColor(u.status, colors)} background={colors.card} />
        </View>
      </View>

      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={16} color={colors.teal} />
          <Text style={[styles.metaLabel, { color: colors.text }]}>{money(u.gross_rent)}/mo</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="bed-outline" size={16} color={colors.teal} />
          <Text style={[styles.metaLabel, { color: colors.text }]}>
            {u.beds === 0 ? 'Studio' : `${u.beds} bed`} / {u.baths} bath
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.teal} />
          <Text style={[styles.metaLabel, { color: colors.text }]}>
            Available{' '}
            {new Date(`${u.available_from}T12:00:00`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>

      {!!u.street_easy_url && (
        <Pressable
          onPress={() => Linking.openURL(u.street_easy_url!)}
          style={({ pressed }) => [
            styles.streetEasyButton,
            cardShadow,
            { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="open-outline" size={18} color={colors.onTeal} />
          <Text style={[styles.streetEasyLabel, { color: colors.onTeal }]}>View on StreetEasy</Text>
        </Pressable>
      )}

      <View style={styles.footer}>
        <View style={[styles.footerBadge, { backgroundColor: colors.tealSoft }]}>
          <Ionicons name="home" size={13} color={colors.teal} />
        </View>
        <Text style={[styles.footerLabel, { color: colors.faint }]}>AgentEasy</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notFoundTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  notFoundBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  container: { paddingHorizontal: 20, paddingBottom: 8 },
  banner: {
    borderRadius: radius.card,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
  },
  bannerName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  bannerSubtitle: { fontSize: 13.5, marginTop: 4, opacity: 0.85 },
  pillWrap: { marginTop: 10 },
  card: {
    borderRadius: radius.card,
    marginTop: 14,
    padding: 18,
    gap: 14,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { fontSize: 15, fontWeight: '600' },
  streetEasyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    minHeight: 50,
    marginTop: 16,
  },
  streetEasyLabel: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 28 },
  footerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
