import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../auth/session';
import { GhostButton, PrimaryButton } from '../components/buttons';
import { cardShadow, HEADER_ICON_SIZE, headerIconButton, radius, useTheme } from '../theme';

const STEPS: { number: string; title: string; description: string }[] = [
  {
    number: '1',
    title: 'Connect your inbox',
    description: 'Hazbot watches your email for new inquiries from StreetEasy and Zillow.',
  },
  {
    number: '2',
    title: 'Reply and book in seconds',
    description: 'Send a reply from your own number and lock in a showing without leaving the app.',
  },
  {
    number: '3',
    title: 'Never lose a deal',
    description: 'Leads, units, and showings live in one dashboard, so nothing slips through the cracks.',
  },
];

export default function OnboardingScreen() {
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
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        hitSlop={8}
        style={({ pressed }) => [
          headerIconButton,
          { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="chevron-back" size={HEADER_ICON_SIZE} color={colors.teal} />
      </Pressable>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.faint }]}>HOW IT WORKS</Text>
        <View style={[styles.stepsCard, cardShadow, { backgroundColor: colors.card }]}>
          {STEPS.map((s, i) => (
            <View
              key={s.number}
              style={[
                styles.stepRow,
                i < STEPS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.stepNumber, { backgroundColor: colors.teal }]}>
                <Text style={[styles.stepNumberLabel, { color: colors.onTeal }]}>{s.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{s.title}</Text>
                <Text style={[styles.stepDescription, { color: colors.subtext }]}>
                  {s.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Create an account" onPress={() => router.push('/signup')} />
        <GhostButton
          label="I already have an account"
          onPress={() => router.push('/login')}
          style={{ marginTop: 10 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 28, paddingBottom: 8 },
  section: { marginTop: 28 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 14 },
  stepsCard: { borderRadius: radius.card, padding: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberLabel: { fontSize: 13, fontWeight: '800' },
  stepTitle: { fontSize: 14.5, fontWeight: '700' },
  stepDescription: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  actions: { paddingTop: 40 },
});
