import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../auth/session';
import { PrimaryButton } from '../components/buttons';
import { TRIAL_DAYS } from '../plans';
import { cardShadow, radius, useTheme } from '../theme';

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'mail-unread-outline', label: 'New leads land in seconds, sorted and ready to reply' },
  { icon: 'chatbubble-outline', label: 'Text clients from your own number — no third-party SMS' },
  { icon: 'calendar-outline', label: 'Every showing tracked, confirmed, and reminded automatically' },
  { icon: 'business-outline', label: 'Live unit inventory — pricing, availability, and access notes in one place' },
];

export default function WelcomeScreen() {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading } = useSession();

  if (!loading && user) {
    return <Redirect href={user.subscribed ? '/(tabs)' : '/paywall'} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={[styles.logoBadge, cardShadow, { backgroundColor: colors.teal }]}>
          <Ionicons name="home" size={36} color={colors.onTeal} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Hazbot</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          The lead cockpit built for one agent at a time.{'\n'}Leads in, deals out.
        </Text>
        <View style={[styles.trialPill, { backgroundColor: colors.tealSoft }]}>
          <Ionicons name="sparkles" size={12} color={colors.teal} />
          <Text style={[styles.trialPillLabel, { color: colors.teal }]}>
            {TRIAL_DAYS}-day free trial · Cancel anytime
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.faint }]}>BUILT FOR AGENTS</Text>
        <View style={styles.highlights}>
          {HIGHLIGHTS.map((h) => (
            <View key={h.label} style={styles.highlightRow}>
              <View style={[styles.highlightIcon, { backgroundColor: colors.tealSoft }]}>
                <Ionicons name={h.icon} size={17} color={colors.teal} />
              </View>
              <Text style={[styles.highlightLabel, { color: colors.text }]}>{h.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Next" onPress={() => router.push('/onboarding')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28, paddingBottom: 8 },
  hero: { alignItems: 'center', marginTop: 24 },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    marginTop: 16,
  },
  trialPillLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  section: { marginTop: 36 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 14 },
  highlights: { gap: 16 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: { flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: '600' },
  actions: { paddingTop: 40 },
});
