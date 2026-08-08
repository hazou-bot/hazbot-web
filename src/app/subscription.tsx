import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSharedAccess } from '../api';
import { useSession } from '../auth/session';
import { GhostButton, PrimaryButton } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { getPlan, PLANS, TRIAL_DAYS } from '../plans';
import { cardShadow, radius, useTheme } from '../theme';
import { PlanId } from '../types';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubscriptionScreen() {
  const colors = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user, changePlan, cancelSubscription, resumeSubscription } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(user?.plan ?? 'basic');
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [seatsInUse, setSeatsInUse] = useState(1);

  useFocusEffect(
    useCallback(() => {
      getSharedAccess().then((people) => setSeatsInUse(1 + people.length));
    }, [])
  );

  const currentPlanId = user?.plan ?? 'basic';
  const currentPlan = getPlan(currentPlanId);
  const selected = getPlan(selectedPlan);
  const planDirty = selectedPlan !== currentPlanId;
  const downgradeBlocked = planDirty && selected.maxSeats < seatsInUse;

  const subscribedAt = user?.subscribedAt ? new Date(user.subscribedAt) : new Date();
  const trialEndsAt = new Date(subscribedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isTrialing = Date.now() < trialEndsAt.getTime();
  const nextBillingDate = new Date(subscribedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextChargeDate = isTrialing ? trialEndsAt : nextBillingDate;
  const isCanceled = user?.cancelAtPeriodEnd ?? false;

  const saveChangePlan = async () => {
    if (downgradeBlocked) {
      toast(
        `${selected.label} only allows ${selected.maxSeats} — remove a teammate in Shared access first`,
        'warning'
      );
      return;
    }
    setSaving(true);
    await changePlan(selectedPlan);
    setSaving(false);
    toast(`Switched to ${selected.label} — ${selected.price}`);
  };

  const doCancel = async () => {
    setCancelModalOpen(false);
    setCanceling(true);
    await cancelSubscription();
    setCanceling(false);
    toast('Subscription canceled — active until the end of this period');
  };

  const resume = async () => {
    setResuming(true);
    await resumeSubscription();
    setResuming(false);
    toast('Subscription resumed');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Current plan</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.planHeaderRow}>
          <Text style={[styles.planName, { color: colors.text }]}>{currentPlan.label}</Text>
          {isCanceled ? (
            <Pill label="Canceling" color={colors.amber} background={colors.amberSoft} />
          ) : isTrialing ? (
            <Pill label="Free trial" color={colors.teal} background={colors.tealSoft} />
          ) : (
            <Pill label="Active" color={colors.teal} background={colors.tealSoft} />
          )}
        </View>
        <Text style={[styles.planPrice, { color: colors.subtext }]}>{currentPlan.price}</Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Pressable onPress={() => router.push('/shared-access-settings')} style={styles.seatsRow}>
          <Ionicons name="people-outline" size={15} color={colors.subtext} />
          <Text style={[styles.seatsLabel, { color: colors.subtext }]}>
            {seatsInUse} of {currentPlan.maxSeats} seat{currentPlan.maxSeats === 1 ? '' : 's'} used
          </Text>
          <Text style={[styles.seatsLink, { color: colors.teal }]}>Manage</Text>
        </Pressable>

        {isCanceled ? (
          <Text style={[styles.statusLine, { color: colors.text }]}>
            Your plan ends on{' '}
            <Text style={{ fontWeight: '700' }}>{formatDate(nextChargeDate)}</Text>. You'll keep
            access until then.
          </Text>
        ) : isTrialing ? (
          <Text style={[styles.statusLine, { color: colors.text }]}>
            Trial ends <Text style={{ fontWeight: '700' }}>{formatDate(trialEndsAt)}</Text>, then{' '}
            {currentPlan.price} billed via your Apple ID.
          </Text>
        ) : (
          <Text style={[styles.statusLine, { color: colors.text }]}>
            Renews <Text style={{ fontWeight: '700' }}>{formatDate(nextChargeDate)}</Text> —{' '}
            {currentPlan.price} via your Apple ID.
          </Text>
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Change plan</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        {PLANS.map((p) => {
          const active = selectedPlan === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelectedPlan(p.id)}
              style={[
                styles.planOption,
                {
                  borderColor: active ? colors.teal : colors.border,
                  borderWidth: active ? 2 : 1,
                  backgroundColor: active ? colors.tealSoft : colors.cardAlt,
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
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{p.label}</Text>
                  <Text style={[styles.optionSub, { color: colors.subtext }]}>{p.tagline}</Text>
                </View>
                <Text style={[styles.optionPrice, { color: colors.text }]}>{p.price}</Text>
              </View>
              {active && (
                <View style={styles.featureList}>
                  {p.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.teal} />
                      <Text style={[styles.featureLabel, { color: colors.subtext }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
        {planDirty && downgradeBlocked && (
          <Text style={[styles.downgradeWarning, { color: colors.danger }]}>
            {selected.label} allows up to {selected.maxSeats} — you have {seatsInUse}. Remove a
            teammate in Shared access first.
          </Text>
        )}
        {planDirty && (
          <PrimaryButton
            label={saving ? 'Saving…' : `Switch to ${selected.label}`}
            onPress={saveChangePlan}
            style={{ marginTop: 6, opacity: downgradeBlocked ? 0.5 : 1 }}
          />
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Billing</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        {isCanceled ? (
          <PrimaryButton
            label={resuming ? 'Resuming…' : 'Resume subscription'}
            onPress={resume}
          />
        ) : (
          <Pressable
            onPress={() => setCancelModalOpen(true)}
            disabled={canceling}
            style={({ pressed }) => [styles.row, { opacity: pressed || canceling ? 0.7 : 1 }]}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>
              {canceling ? 'Canceling…' : 'Cancel subscription'}
            </Text>
          </Pressable>
        )}
        <Text style={[styles.hint, { color: colors.faint }]}>
          Managed via your Apple ID. Canceling stops future charges — you keep access until the
          current period ends.
        </Text>
      </View>

      <Modal
        visible={cancelModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Cancel your subscription?
            </Text>
            <Text style={[styles.modalBody, { color: colors.subtext }]}>
              You'll keep full access until{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {formatDate(nextChargeDate)}
              </Text>
              , then Hazbot will stop working until you resubscribe.
            </Text>
            <View style={styles.modalActions}>
              <GhostButton
                label="Keep subscription"
                onPress={() => setCancelModalOpen(false)}
                style={styles.modalButton}
              />
              <Pressable
                onPress={doCancel}
                style={({ pressed }) => [
                  styles.modalDangerButton,
                  { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalDangerLabel}>Cancel subscription</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, padding: 16 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  planPrice: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  divider: { height: 1, marginVertical: 14 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  seatsLabel: { fontSize: 13, flex: 1 },
  seatsLink: { fontSize: 13, fontWeight: '700' },
  statusLine: { fontSize: 14, lineHeight: 20 },
  planOption: { borderRadius: radius.card, padding: 14, marginBottom: 10 },
  featureList: { marginTop: 10, gap: 6, paddingLeft: 34 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureLabel: { fontSize: 12, flex: 1 },
  downgradeWarning: { fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 4 },
  planBadge: { marginBottom: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  optionSub: { fontSize: 12.5, marginTop: 2 },
  optionPrice: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  hint: { fontSize: 12, marginTop: 12, lineHeight: 17 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 10 },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalButton: { flex: 1 },
  modalDangerButton: {
    flex: 1,
    borderRadius: radius.button,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
});
