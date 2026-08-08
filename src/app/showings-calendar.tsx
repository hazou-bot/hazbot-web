import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getShowingCompletedState, getShowings, getUnit } from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel } from '../components/buttons';
import { useContactSheet } from '../components/contactSheet';
import { PressableCard } from '../components/pressableCard';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { composeSms } from '../sms';
import { cardShadow, radius, useTheme } from '../theme';
import { Showing, Unit } from '../types';
import { formatPhoneDisplay } from '../validation';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayIso(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function monthLabel(cursor: Date): string {
  return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const STATUS_LABEL: Record<Showing['status'], string> = {
  confirmed: 'Confirmed',
  no_answer: 'No answer',
  reschedule_requested: 'Reschedule',
  cancelled: 'Cancelled',
};

// Cancelled showings never actually reach this screen — getShowings() always
// excludes them, they only ever show up in Showing history — but the branch
// is here for type completeness (and in case that ever changes).
function statusPillColors(status: Showing['status'], colors: ReturnType<typeof useTheme>) {
  if (status === 'confirmed') return { color: colors.teal, background: colors.tealSoft };
  if (status === 'cancelled') return { color: colors.subtext, background: colors.cardAlt };
  if (status === 'no_answer') return { color: colors.danger, background: `${colors.danger}1A` };
  return { color: colors.yellow, background: `${colors.yellow}1A` };
}

function dayLabel(iso: string): string {
  if (iso === todayIso()) return 'Today';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** "today" / "tomorrow" / "on Friday, Jul 17" — for the text message body. */
function dayPhrase(iso: string): string {
  if (iso === todayIso()) return 'today';
  if (iso === todayIso(1)) return 'tomorrow';
  return `on ${dayLabel(iso)}`;
}

/** Weeks of ISO date strings (or null for out-of-month filler cells). */
function buildMonthGrid(cursor: Date): (string | null)[][] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function ShowingsCalendarScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { promptPhone } = useContactSheet();
  const { user } = useSession();
  const [showings, setShowings] = useState<Showing[] | null>(null);
  const [completed, setCompleted] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(todayIso());
  const [detail, setDetail] = useState<Showing | null>(null);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);

  useEffect(() => {
    getShowings({ includePast: true }).then(setShowings);
    getShowingCompletedState().then(setCompleted);
  }, []);

  const openDetail = (s: Showing) => {
    setDetail(s);
    setDetailUnit(null);
    if (s.unitId) {
      setUnitLoading(true);
      getUnit(s.unitId).then((u) => {
        setDetailUnit(u ?? null);
        setUnitLoading(false);
      });
    }
  };

  const byDate = useMemo(() => {
    const map = new Map<string, Showing[]>();
    for (const s of showings ?? []) {
      map.set(s.date, [...(map.get(s.date) ?? []), s]);
    }
    return map;
  }, [showings]);

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const selectedShowings = useMemo(
    () => [...(byDate.get(selected) ?? [])].sort((a, b) => a.time.localeCompare(b.time)),
    [byDate, selected]
  );

  const goPrevMonth = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNextMonth = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));

  const confirmViaMessage = async (s: Showing) => {
    if (!s.phone) {
      toast('No phone number saved for this showing', 'error');
      return;
    }
    const firstName = s.client.split(' ')[0];
    const agentFirst = (user?.name ?? 'your agent').split(' ')[0];
    const brokerage = user?.brokerage ?? 'Brooklyn Group';
    const message =
      `Hi ${firstName}, this is ${agentFirst} from ${brokerage} — just confirming ` +
      `your showing ${dayPhrase(s.date)} at ${s.time} for ${s.address}. Reply YES to confirm.`;
    const outcome = await composeSms([s.phone], message);
    if (outcome === 'copied') {
      toast('Message copied — paste it into your texting app.');
    } else if (outcome === 'unavailable') {
      toast('Texting isn’t available in this browser.', 'error');
    }
  };

  if (!showings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.calendarCard, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.monthHeader}>
          <Pressable onPress={goPrevMonth} hitSlop={10} style={styles.monthNavButton}>
            <Ionicons name="chevron-back" size={22} color={colors.teal} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel(cursor)}</Text>
          <Pressable onPress={goNextMonth} hitSlop={10} style={styles.monthNavButton}>
            <Ionicons name="chevron-forward" size={22} color={colors.teal} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((w, i) => (
            <Text key={i} style={[styles.weekdayLabel, { color: colors.faint }]}>
              {w}
            </Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((iso, di) => {
              if (!iso) return <View key={di} style={styles.dayCell} />;
              const dayShowings = byDate.get(iso) ?? [];
              const isSelected = iso === selected;
              const isToday = iso === todayIso();
              const allCompleted =
                dayShowings.length > 0 && dayShowings.every((s) => completed[s.id]);
              const dotColor = dayShowings.some((s) => s.status === 'no_answer')
                ? colors.danger
                : dayShowings.some((s) => s.status === 'reschedule_requested')
                  ? colors.yellow
                  : colors.teal;
              return (
                <Pressable key={di} onPress={() => setSelected(iso)} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayNumberWrap,
                      isSelected && { backgroundColor: colors.teal },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.teal },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: isSelected ? colors.onTeal : colors.text },
                      ]}
                    >
                      {Number(iso.slice(-2))}
                    </Text>
                  </View>
                  {allCompleted ? (
                    <Ionicons name="checkmark-circle" size={9} color={colors.teal} style={styles.completedMark} />
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: dayShowings.length > 0 ? dotColor : 'transparent' },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.teal, marginTop: 0 }]} />
          <Text style={[styles.legendLabel, { color: colors.faint }]}>Has showings</Text>
          <Ionicons name="checkmark-circle" size={9} color={colors.teal} />
          <Text style={[styles.legendLabel, { color: colors.faint }]}>All completed</Text>
        </View>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>{dayLabel(selected)}</Text>

      {selectedShowings.length === 0 ? (
        <Text style={[styles.empty, { color: colors.faint }]}>No showings scheduled.</Text>
      ) : (
        selectedShowings.map((s) => (
          <PressableCard key={s.id} onPress={() => openDetail(s)} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTime, { color: colors.text }]}>{s.time}</Text>
              {completed[s.id] ? (
                <Pill label="Done" color={colors.teal} background={colors.tealSoft} />
              ) : (
                <Pill label={STATUS_LABEL[s.status]} {...statusPillColors(s.status, colors)} />
              )}
            </View>
            <Text style={[styles.cardClient, { color: colors.text }]}>
              {s.client}{' '}
              <Text
                style={{ color: colors.teal }}
                onPress={(e) => {
                  e.stopPropagation?.();
                  promptPhone(s.phone, s.client);
                }}
              >
                {formatPhoneDisplay(s.phone)}
              </Text>
            </Text>
            <Text style={[styles.cardAddress, { color: colors.subtext }]}>{s.address}</Text>
          </PressableCard>
        ))
      )}

      <Modal
        visible={detail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetail(null)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            {detail && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTime, { color: colors.text }]}>
                    {detail.time} · {dayLabel(detail.date)}
                  </Text>
                  {completed[detail.id] ? (
                    <Pill label="Done" color={colors.teal} background={colors.tealSoft} />
                  ) : (
                    <Pill label={STATUS_LABEL[detail.status]} {...statusPillColors(detail.status, colors)} />
                  )}
                </View>

                <Text style={[styles.modalAddress, { color: colors.text }]}>{detail.address}</Text>

                <View style={styles.modalRows}>
                  <Text style={[styles.modalRow, { color: colors.subtext }]}>
                    <Ionicons name="person-outline" size={14} color={colors.subtext} />{' '}
                    {detail.client}  ·{' '}
                    <Text
                      style={{ color: colors.teal }}
                      onPress={() => {
                        // Close this modal before opening the shared call/text
                        // prompt — two native Modals stacked at once render
                        // unreliably (the newer one can paint behind the older
                        // one), same reasoning as showings.tsx's detail modal.
                        const phone = detail.phone;
                        const name = detail.client;
                        setDetail(null);
                        promptPhone(phone, name);
                      }}
                    >
                      {formatPhoneDisplay(detail.phone)}
                    </Text>
                  </Text>

                  {unitLoading ? (
                    <ActivityIndicator color={colors.teal} style={{ marginVertical: 8 }} />
                  ) : detailUnit ? (
                    <>
                      <Text style={[styles.modalRow, { color: colors.subtext }]}>
                        <Ionicons name="pricetag-outline" size={14} color={colors.subtext} />{' '}
                        ${detailUnit.grossRent.toLocaleString('en-US')} gross
                        {detailUnit.netRent !== detailUnit.grossRent &&
                          ` · $${detailUnit.netRent.toLocaleString('en-US')} net`}
                        {'  ·  move-in from '}
                        {new Date(`${detailUnit.availableFrom}T12:00:00`).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </Text>
                      <Text style={[styles.modalRow, { color: colors.subtext }]}>
                        <Ionicons name="business-outline" size={14} color={colors.subtext} />{' '}
                        {detailUnit.building} · {detailUnit.neighborhood} ·{' '}
                        {detailUnit.beds === 0 ? 'Studio' : `${detailUnit.beds} bed`} /{' '}
                        {detailUnit.baths} bath
                      </Text>
                      <Text style={[styles.modalRow, { color: colors.subtext }]}>
                        <Ionicons name="key-outline" size={14} color={colors.subtext} />{' '}
                        {detailUnit.occupancy}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.modalRow, { color: colors.faint }]}>
                      Manually scheduled — no linked unit.
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => confirmViaMessage(detail)}
                  style={({ pressed }) => [
                    styles.messageButton,
                    { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <IconLabel
                    icon="chatbubble-outline"
                    iconSize={15}
                    color={colors.onTeal}
                    label="Message"
                    fontSize={15}
                  />
                </Pressable>

                {detailUnit && (
                  <Pressable
                    onPress={() => Linking.openURL(detailUnit.streetEasyUrl)}
                    style={({ pressed }) => [
                      styles.modalLink,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <IconLabel
                      icon="open-outline"
                      iconSize={15}
                      color={colors.teal}
                      label="View listing"
                      fontSize={14}
                      fontWeight="600"
                    />
                  </Pressable>
                )}

                <GhostButton
                  label="Close"
                  onPress={() => setDetail(null)}
                  style={{ marginTop: 10 }}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 18, paddingBottom: 40 },
  calendarCard: {
    borderRadius: radius.card,
    padding: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavButton: { padding: 6 },
  monthLabel: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontSize: 14, fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 4 },
  completedMark: { marginTop: 3 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },
  legendLabel: { fontSize: 11, fontWeight: '600', marginRight: 10 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 10,
  },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 16 },
  card: { padding: 16, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  cardClient: { fontSize: 14.5, fontWeight: '600', marginTop: 8 },
  cardAddress: { fontSize: 13.5, marginTop: 3 },
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
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  modalTime: { fontSize: 18, fontWeight: '700' },
  modalAddress: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  modalRows: { marginTop: 10, gap: 7 },
  modalRow: { fontSize: 13.5, lineHeight: 19 },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.button,
    paddingVertical: 13,
    marginTop: 14,
  },
  messageLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  modalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 10,
    marginTop: 14,
  },
  modalLinkLabel: { fontSize: 14, fontWeight: '600' },
});
