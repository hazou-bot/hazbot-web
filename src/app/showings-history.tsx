import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getShowingCompletedState, getShowingHistory } from '../api';
import { useContactSheet } from '../components/contactSheet';
import { Pill } from '../components/pill';
import { cardShadow, radius, useTheme } from '../theme';
import { Showing } from '../types';
import { formatPhoneDisplay } from '../validation';

const STATUS_LABEL: Record<Showing['status'], string> = {
  confirmed: 'Confirmed',
  no_answer: 'No answer',
  reschedule_requested: 'Reschedule',
  cancelled: 'Cancelled',
};

// A completed showing always reads as "Done" here regardless of its
// underlying status — same completed-flag-wins precedence the live agenda
// uses, so the two screens never disagree about what a showing's outcome was.
function outcomeLabel(s: Showing, completedFlag: boolean): string {
  return completedFlag ? 'Done' : STATUS_LABEL[s.status];
}

function outcomeColors(status: Showing['status'], completedFlag: boolean, colors: ReturnType<typeof useTheme>) {
  if (completedFlag) return { color: colors.teal, background: colors.tealSoft };
  if (status === 'cancelled') return { color: colors.danger, background: `${colors.danger}1A` };
  if (status === 'no_answer') return { color: colors.yellow, background: `${colors.yellow}1A` };
  if (status === 'reschedule_requested') return { color: colors.yellow, background: `${colors.yellow}1A` };
  return { color: colors.teal, background: colors.tealSoft };
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

export default function ShowingHistoryScreen() {
  const colors = useTheme();
  const { promptPhone } = useContactSheet();
  const [showings, setShowings] = useState<Showing[] | null>(null);
  const [completed, setCompleted] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      getShowingHistory().then(setShowings);
      getShowingCompletedState().then(setCompleted);
    }, [])
  );

  // getShowingHistory() already returns newest-first — grouping preserves
  // that order since Map iterates in insertion order.
  const sections = useMemo(() => {
    if (!showings) return [];
    const byDate = new Map<string, Showing[]>();
    for (const s of showings) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
    }
    return [...byDate.entries()];
  }, [showings]);

  if (!showings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.intro, { color: colors.subtext }]}>
        Showings move here once their date has passed or they're cancelled. Adjust how long
        history sticks around in Showing settings.
      </Text>

      {sections.length === 0 && (
        <Text style={[styles.empty, { color: colors.subtext }]}>
          No showing history yet — completed, no-show, and cancelled showings will collect
          here as their dates pass.
        </Text>
      )}

      {sections.map(([date, dayShowings]) => (
        <View key={date}>
          <Text style={[styles.sectionHeader, { color: colors.subtext }]}>
            {historyDayLabel(date)}
          </Text>
          {dayShowings.map((s) => {
            const completedFlag = !!completed[s.id];
            const { color, background } = outcomeColors(s.status, completedFlag, colors);
            return (
              <View key={s.id} style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
                <View style={styles.headerRow}>
                  <Text style={[styles.time, { color: colors.text }]}>{s.time}</Text>
                  <Pill label={outcomeLabel(s, completedFlag)} color={color} background={background} />
                </View>
                <Text style={[styles.address, { color: colors.text }]} numberOfLines={1}>
                  {s.address}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={13} color={colors.subtext} />
                  <Text style={[styles.metaText, { color: colors.subtext }]} numberOfLines={1}>
                    {s.client}
                    {s.phone && '  ·  '}
                    {s.phone && (
                      <Text style={{ color: colors.teal }} onPress={() => promptPhone(s.phone, s.client)}>
                        {formatPhoneDisplay(s.phone)}
                      </Text>
                    )}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
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
  time: { fontSize: 15, fontWeight: '700' },
  address: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 13, flexShrink: 1 },
});
