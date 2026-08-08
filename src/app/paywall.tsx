import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../auth/session';
import { PrimaryButton } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { PLANS, TRIAL_DAYS } from '../plans';
import { cardShadow, radius, useTheme } from '../theme';
import { PlanId } from '../types';

export default function PaywallScreen() {
  const colors = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, loading, subscribe, signOut } = useSession();
  const [plan, setPlan] = useState<PlanId>('pro');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (!loading && !user) return <Redirect href="/welcome" />;
  if (!loading && user && !user.hearAboutSource) return <Redirect href="/how-heard" />;
  if (!loading && user?.subscribed) return <Redirect href="/(tabs)" />;

  const selected = PLANS.find((p) => p.id === plan) ?? PLANS[0];

  const startTrial = async () => {
    setPurchasing(true);
    await subscribe(plan);
    setPurchasing(false);
    router.replace('/(tabs)');
  };

  const restore = async () => {
    setRestoring(true);
    // TODO: real StoreKit restore-purchases call
    await subscribe(plan);
    setRestoring(false);
    toast('Purchases restored');
    router.replace('/(tabs)');
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.badge, cardShadow, { backgroundColor: colors.teal }]}>
        <Ionicons name="sparkles" size={28} color={colors.onTeal} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Unlock Hazbot</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        Start your {TRIAL_DAYS}-day free trial — cancel anytime, no charge until the trial ends.
      </Text>

      <View style={styles.plans}>
        {PLANS.map((p) => {
          const active = plan === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPlan(p.id)}
              style={[
                styles.planCard,
                cardShadow,
                {
                  backgroundColor: colors.card,
                  borderColor: active ? colors.teal : colors.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              {p.badge && (
                <Pill
                  label={p.badge}
                  color={colors.amber}
                  background={colors.amberSoft}
                  style={styles.planBadge}
                />
              )}
              <View style={styles.planRow}>
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? colors.teal : colors.border },
                    active && { backgroundColor: colors.teal },
                  ]}
                >
                  {active && <Ionicons name="checkmark" size={13} color={colors.onTeal} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planLabel, { color: colors.text }]}>{p.label}</Text>
                  <Text style={[styles.planSub, { color: colors.subtext }]}>{p.tagline}</Text>
                </View>
                <Text style={[styles.planPrice, { color: colors.text }]}>{p.price}</Text>
              </View>
              <View style={styles.featureList}>
                {p.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
                    <Text style={[styles.featureLabel, { color: colors.subtext }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton
        label={purchasing ? 'Starting trial…' : 'Start free trial'}
        onPress={startTrial}
        style={{ marginTop: 20 }}
      />

      <Text style={[styles.finePrint, { color: colors.faint }]}>
        {TRIAL_DAYS}-day free trial, then {selected.price} billed via your Apple ID. Cancel
        anytime in Settings.
      </Text>

      <Pressable onPress={restore} disabled={restoring} style={{ marginTop: 18 }}>
        {restoring ? (
          <ActivityIndicator color={colors.teal} size="small" />
        ) : (
          <Text style={[styles.linkLabel, { color: colors.teal }]}>Restore purchases</Text>
        )}
      </Pressable>

      <Pressable onPress={() => signOut()} style={{ marginTop: 14 }}>
        <Text style={[styles.linkLabel, { color: colors.faint }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 28, paddingTop: 56 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14.5, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 },
  plans: { width: '100%', gap: 12, marginTop: 26 },
  planCard: { borderRadius: radius.card, padding: 16 },
  planBadge: { position: 'absolute', top: -10, right: 14 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLabel: { fontSize: 16, fontWeight: '700' },
  planSub: { fontSize: 12.5, marginTop: 2 },
  planPrice: { fontSize: 15, fontWeight: '700' },
  featureList: { marginTop: 12, gap: 6, paddingLeft: 34 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featureLabel: { fontSize: 12.5, flex: 1 },
  finePrint: { fontSize: 11.5, textAlign: 'center', marginTop: 14, lineHeight: 16, maxWidth: 300 },
  linkLabel: { fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
});
