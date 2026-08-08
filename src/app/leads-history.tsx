import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearAllLeadHistory, getLeadHistory } from '../api';
import { GhostButton } from '../components/buttons';
import { PressableCard } from '../components/pressableCard';
import { useToast } from '../components/toast';
import { cardShadow, HEADER_ICON_SIZE, headerIconButton, radius, useTheme } from '../theme';
import { LeadHistoryEntry } from '../types';
import { formatPhoneDisplay } from '../validation';

function formatSentTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function historyDayLabel(iso: string): string {
  if (iso === todayIso()) return 'Today';
  if (iso === yesterdayIso()) return 'Yesterday';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function LeadHistoryScreen() {
  const colors = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const [entries, setEntries] = useState<LeadHistoryEntry[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getLeadHistory().then(setEntries);
    }, [])
  );

  const clearAll = async () => {
    setClearing(true);
    await clearAllLeadHistory();
    setEntries([]);
    setClearing(false);
    setConfirmOpen(false);
    toast('Lead history cleared');
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        entries && entries.length > 0 ? (
          <Pressable
            onPress={() => setConfirmOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1, marginRight: 16 },
            ]}
          >
            <Ionicons name="trash-outline" size={HEADER_ICON_SIZE} color={colors.danger} />
          </Pressable>
        ) : null,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [navigation, colors, entries]);

  // getLeadHistory() already returns newest-first — grouping preserves that
  // order since Map iterates in insertion order.
  const sections = useMemo(() => {
    if (!entries) return [];
    const byDate = new Map<string, LeadHistoryEntry[]>();
    for (const entry of entries) {
      const day = entry.lastSentAt.slice(0, 10);
      byDate.set(day, [...(byDate.get(day) ?? []), entry]);
    }
    return [...byDate.entries()];
  }, [entries]);

  if (!entries) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.intro, { color: colors.subtext }]}>
        Every lead you've sent a script or custom reply to collects here. Adjust how long
        history sticks around in Lead settings.
      </Text>

      {sections.length === 0 && (
        <Text style={[styles.empty, { color: colors.subtext }]}>
          No sent leads yet — replying to a lead (script, custom, or Reply All) will show up
          here.
        </Text>
      )}

      {sections.map(([day, dayEntries]) => (
        <View key={day}>
          <Text style={[styles.sectionHeader, { color: colors.subtext }]}>
            {historyDayLabel(day)}
          </Text>
          {dayEntries.map(({ lead, messages, lastSentAt }) => (
            <PressableCard
              key={lead.id}
              onPress={() => router.push({ pathname: '/leads-history/[id]', params: { id: lead.id } })}
              style={styles.card}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {lead.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </View>
              <Text style={[styles.address, { color: colors.text }]} numberOfLines={1}>
                {lead.listing}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={13} color={colors.subtext} />
                <Text style={[styles.metaText, { color: colors.subtext }]} numberOfLines={1}>
                  {formatPhoneDisplay(lead.phone)} · {lead.email}
                </Text>
              </View>
              <Text style={[styles.sentLine, { color: colors.faint }]}>
                {messages.length} message{messages.length === 1 ? '' : 's'} sent · last{' '}
                {formatSentTime(lastSentAt)}
              </Text>
            </PressableCard>
          ))}
        </View>
      ))}
    </ScrollView>

    <Modal
      visible={confirmOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setConfirmOpen(false)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>Clear all lead history?</Text>
          <Text style={[styles.modalBody, { color: colors.subtext }]}>
            All {entries?.length ?? 0} lead{entries?.length === 1 ? '' : 's'}' sent-message threads
            will be cleared. The leads themselves aren't affected — they stay in Leads and
            Contacts.
          </Text>
          <View style={styles.modalActions}>
            <GhostButton
              label="Cancel"
              onPress={() => setConfirmOpen(false)}
              style={styles.modalButton}
            />
            <Pressable
              onPress={clearAll}
              disabled={clearing}
              style={({ pressed }) => [
                styles.modalDangerButton,
                { backgroundColor: colors.danger, opacity: pressed || clearing ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.modalDangerLabel}>{clearing ? 'Clearing…' : 'Clear all'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 18, paddingBottom: 40 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15, lineHeight: 21, paddingHorizontal: 12 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  address: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 13, flexShrink: 1 },
  sentLine: { fontSize: 11, marginTop: 8 },
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
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1 },
  modalDangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
});
