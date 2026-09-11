import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addShowing,
  cancelShowing,
  deleteShowing,
  getContacts,
  getOutgoingSettings,
  getSettings,
  getShowingCompletedState,
  getShowings,
  getShowingSettings,
  getShowingSmsSentState,
  getUnit,
  getUnseenShowingCount,
  markShowingsViewed,
  markShowingSmsSent,
  rescheduleShowing,
  setShowingCompleted,
  simulateShowingReply,
  updateOutgoingSettings,
  updateShowingSettings,
} from '../../api';
import { useSession } from '../../auth/session';
import { useSetBadgeCount } from '../../badges';
import { GhostButton, IconLabel, PrimaryButton } from '../../components/buttons';
import { useContactSheet } from '../../components/contactSheet';
import { Pill } from '../../components/pill';
import { PressableCard } from '../../components/pressableCard';
import { useToast } from '../../components/toast';
import { Identity, getPhoneIdentities } from '../../identities';
import { rescheduleShowingReminders } from '../../notifications';
import { composeSms } from '../../sms';
import {
  HEADER_ICON_SIZE,
  cardShadow,
  headerIconButton,
  headerRightRow,
  radius,
  useTheme,
} from '../../theme';
import { AppSettings, Lead, Showing, ShowingSettings, Unit } from '../../types';
import { capitalizeWords, formatPhoneDisplay } from '../../validation';

function isoToday(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Inline, on-the-form validation error (red field borders + a small message
// under the buttons) — replaces the old generic toast, which didn't point at
// which field was actually the problem.
interface FormFieldError {
  date?: boolean;
  time?: boolean;
  name?: boolean;
  address?: boolean;
  message: string;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLabel(cursor: Date): string {
  return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Weeks of ISO date strings (or null for out-of-month filler cells) — same
 * grid-building logic as showings-calendar.tsx's full-page calendar, sized
 * down for use inside the reschedule popup. */
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

function dayLabel(iso: string): string {
  if (iso === isoToday(0)) return 'Today';
  if (iso === isoToday(1)) return 'Tomorrow';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Compact weekday ("Wed" instead of "Wednesday") — dayLabel's full weekday
 * wraps to a second line next to the status pill in the showing detail
 * modal's title row; a short form keeps it clean on one line. */
function shortDayLabel(iso: string): string {
  if (iso === isoToday(0)) return 'Today';
  if (iso === isoToday(1)) return 'Tomorrow';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "today" / "tomorrow" / "on Friday, Jul 17" — for the text message body. */
function dayPhrase(iso: string): string {
  const label = dayLabel(iso);
  return label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : `on ${label}`;
}

export default function ShowingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { promptPhone } = useContactSheet();
  const { user } = useSession();
  const navigation = useNavigation();
  const router = useRouter();
  const [showings, setShowings] = useState<Showing[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [smsSent, setSmsSent] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<ShowingSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [selected, setSelected] = useState<Showing | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedMeridiem, setSchedMeridiem] = useState<'AM' | 'PM' | null>(null);
  const [schedName, setSchedName] = useState('');
  const [schedAddress, setSchedAddress] = useState('');
  const [schedPhone, setSchedPhone] = useState('');
  const [schedEmail, setSchedEmail] = useState('');
  const [schedFormError, setSchedFormError] = useState<FormFieldError | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [contacts, setContacts] = useState<Lead[]>([]);
  const [pickedContact, setPickedContact] = useState<Lead | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Showing | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleMeridiem, setRescheduleMeridiem] = useState<'AM' | 'PM' | null>(null);
  // The Time field opens pre-filled with the showing's current time — the
  // first tap into it clears that stale value so the number pad starts the
  // new time from scratch, instead of making the user manually backspace it
  // first. Only the *first* focus clears it; tapping AM/PM (which blurs the
  // input) and then back in to tweak the hour must not wipe what was already
  // typed.
  const rescheduleTimeClearedRef = useRef(false);
  const [rescheduleFormError, setRescheduleFormError] = useState<FormFieldError | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleCalendarOpen, setRescheduleCalendarOpen] = useState(false);
  const [rescheduleCalendarCursor, setRescheduleCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [schedCalendarOpen, setSchedCalendarOpen] = useState(false);
  const [schedCalendarCursor, setSchedCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [deleteTarget, setDeleteTarget] = useState<Showing | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [phoneIdentities, setPhoneIdentities] = useState<Identity[]>([]);
  const [phoneIdentityId, setPhoneIdentityId] = useState('me');
  const [identityDropdownOpen, setIdentityDropdownOpen] = useState(false);

  const setBadgeCount = useSetBadgeCount('showings');
  const refreshBadgeCount = useCallback(() => {
    getUnseenShowingCount().then(setBadgeCount);
  }, [setBadgeCount]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // A merged multi-attendee slot is one accordion row for several Showing
  // records — opening it counts as viewing all of them, not just the first.
  const openGroup = (group: Showing[], groupKey: string) => {
    toggleExpanded(groupKey);
    markShowingsViewed(group.map((s) => s.id)).then(refreshBadgeCount);
  };

  const resetSchedForm = useCallback(() => {
    setSchedDate('');
    setSchedTime('');
    setSchedMeridiem(null);
    setSchedName('');
    setSchedAddress('');
    setSchedPhone('');
    setSchedEmail('');
    setPickedContact(null);
    setSchedFormError(null);
    setSchedCalendarOpen(false);
    const now = new Date();
    setSchedCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  // Every time the popup opens: start from a blank form and load contacts
  // fresh for autocomplete (Cancel/backdrop-tap don't clear the form,
  // so this is the single place that guarantees it's empty).
  useEffect(() => {
    if (schedOpen) {
      resetSchedForm();
      getContacts().then(setContacts);
    }
  }, [schedOpen, resetSchedForm]);

  // Shared matcher behind every field's autocomplete dropdown: filters
  // contacts by the given Lead property, suppressed once the field's value
  // exactly matches the contact that was just picked (so selecting a
  // suggestion doesn't immediately reopen its own dropdown).
  const makeSuggestions = useCallback(
    (query: string, field: 'name' | 'listing' | 'phone' | 'email') => {
      const q = query.trim().toLowerCase();
      if (q.length < 1) return [];
      if (pickedContact && pickedContact[field].toLowerCase() === q) return [];
      return contacts.filter((c) => c[field].toLowerCase().includes(q)).slice(0, 3);
    },
    [contacts, pickedContact]
  );

  const nameSuggestions = useMemo(() => makeSuggestions(schedName, 'name'), [makeSuggestions, schedName]);
  const addressSuggestions = useMemo(
    () => makeSuggestions(schedAddress, 'listing'),
    [makeSuggestions, schedAddress]
  );
  const phoneSuggestions = useMemo(
    () => makeSuggestions(schedPhone, 'phone'),
    [makeSuggestions, schedPhone]
  );
  const emailSuggestions = useMemo(
    () => makeSuggestions(schedEmail, 'email'),
    [makeSuggestions, schedEmail]
  );

  const pickContact = (c: Lead) => {
    Keyboard.dismiss();
    setSchedName(c.name);
    setSchedPhone(c.phone);
    // Lead.listing is "street address, neighborhood" (e.g. "145 Driggs Ave
    // #1F, Greenpoint") — the showing's address field should only ever be
    // the street portion, or it drags the neighborhood into the showing's
    // title row too, where there's no room for it on one line.
    setSchedAddress(c.listing.split(',')[0].trim());
    setSchedEmail(c.email);
    setPickedContact(c);
  };

  const renderSuggestions = (items: Lead[]) =>
    items.length > 0 && (
      <View style={[styles.suggestions, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
        {items.map((c, i) => (
          <Pressable
            key={c.id}
            onPress={() => pickContact(c)}
            style={({ pressed }) => [
              styles.suggestionRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="person-circle-outline" size={18} color={colors.teal} />
            <View style={styles.suggestionText}>
              <Text style={[styles.suggestionName, { color: colors.text }]}>{c.name}</Text>
              <Text style={[styles.suggestionMeta, { color: colors.subtext }]}>
                {formatPhoneDisplay(c.phone)} · {c.listing}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    );

  const openDetail = (s: Showing) => {
    setSelected(s);
    setSelectedUnit(null);
    if (s.unitId) {
      setUnitLoading(true);
      getUnit(s.unitId).then((u) => {
        setSelectedUnit(u ?? null);
        setUnitLoading(false);
      });
    }
  };

  const loadShowings = useCallback(async () => {
    const [list, sms, done] = await Promise.all([
      getShowings(),
      getShowingSmsSentState(),
      getShowingCompletedState(),
    ]);
    setShowings(list);
    setSmsSent(sms);
    setCompleted(done);
    refreshBadgeCount();
  }, [refreshBadgeCount]);

  useEffect(() => {
    loadShowings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // TODO: replace with a real inbox/calendar sync once showings come from a
  // backend — for now this just re-reads local state, same as the mock
  // getShowings() call the mount effect already makes.
  const refresh = async () => {
    setRefreshing(true);
    await loadShowings();
    setRefreshing(false);
  };

  const toggleCompleted = async (s: Showing) => {
    const wasCompleted = !!completed[s.id];
    await setShowingCompleted(s.id, !wasCompleted);
    setCompleted((prev) => {
      const next = { ...prev };
      if (wasCompleted) {
        delete next[s.id];
      } else {
        next[s.id] = new Date().toISOString();
      }
      return next;
    });
    toast(wasCompleted ? 'Unmarked as done' : `Showing with ${s.client} marked done`);
  };

  // Splits an existing "H:MM AM/PM" string (e.g. a showing's current time)
  // into its digit and meridiem parts, to seed the two pieces of state
  // separately when a form opens pre-filled.
  const splitTime = (full: string): { digits: string; meridiem: 'AM' | 'PM' | null } => {
    const m = full.trim().match(/^(.*?)\s*([ap]m)\s*$/i);
    return m
      ? { digits: m[1].trim(), meridiem: m[2].toUpperCase() as 'AM' | 'PM' }
      : { digits: full.trim(), meridiem: null };
  };

  // Two distinct ways a time field can look "filled in" but isn't: no digits
  // typed yet, or digits typed but AM/PM never tapped — both used to pass a
  // plain `.trim()` non-empty check. The second one is a confirmed real bug:
  // it let a showing save as "5 – 301 Graham Ave", no AM/PM at all, silently
  // accepted. A complete time needs a digit AND a meridiem.
  const isCompleteTime = (digits: string, meridiem: 'AM' | 'PM' | null): boolean =>
    /\d/.test(digits) && meridiem !== null;

  // A bare hour like "5" needs to become "5:00" before it's saved — leaves
  // anything that isn't a clean hour[:minute] alone rather than mangling it.
  const normalizeHourMinute = (numeric: string): string => {
    const trimmed = numeric.trim();
    const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return trimmed;
    const [, hour, minute] = match;
    return `${hour}:${(minute ?? '00').padStart(2, '0')}`;
  };

  // Joins the digit and meridiem state back into the "H:MM AM/PM" string the
  // rest of the app (and the mock backend) expects, normalizing the hour on
  // the way. Meridiem lives in its own state rather than being baked into
  // the typed text — see formatTimeTyped's comment for why.
  const combineTime = (digits: string, meridiem: 'AM' | 'PM' | null): string => {
    const formatted = normalizeHourMinute(digits);
    return meridiem && formatted ? `${formatted} ${meridiem}` : formatted;
  };

  // Time fields are number-pad only (no letter keys, so no way to type
  // "am"/"pm" directly) — this masks raw digits into "H:MM" as the user
  // types, e.g. "5","3","0" -> "5:3" -> "5:30". A leading "1" waits for a
  // possible second hour digit (0/1/2, for 10/11/12) before locking the hour
  // segment; any other leading digit is a one-digit hour. Caps at 4 digits
  // total (H[H]MM).
  //
  // Meridiem is tracked as separate state rather than appended into this
  // string — an earlier version re-appended " AM"/" PM" into the text on
  // every keystroke so the field would "remember" which button was tapped.
  // That silently defeated backspace: deleting the trailing letter(s) of
  // " PM" just got them re-appended right back before the next keystroke,
  // so once a meridiem was set there was no way to ever reach the digits
  // again to fix them — confirmed real bug, reported from a real device.
  // Keeping the field pure digits means backspace always does exactly what
  // it looks like it does.
  const formatTimeTyped = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    const twoDigitHour = digits[0] === '1' && digits.length >= 2 && ['0', '1', '2'].includes(digits[1]);
    const hourLen = twoDigitHour ? 2 : 1;
    const hourDigits = digits.slice(0, hourLen);
    const minuteDigits = digits.slice(hourLen, hourLen + 2);
    return minuteDigits ? `${hourDigits}:${minuteDigits}` : hourDigits;
  };

  const openReschedule = (s: Showing) => {
    setRescheduleTarget(s);
    // ISO "YYYY-MM-DD" -> "MM-DD", matching the schedule form's date input.
    setRescheduleDate(s.date.slice(5));
    const split = splitTime(s.time);
    setRescheduleTime(split.digits);
    setRescheduleMeridiem(split.meridiem);
    rescheduleTimeClearedRef.current = false;
    setRescheduleFormError(null);
    setRescheduleCalendarOpen(false);
    const showingDate = new Date(`${s.date}T12:00:00`);
    setRescheduleCalendarCursor(new Date(showingDate.getFullYear(), showingDate.getMonth(), 1));
  };

  const goPrevRescheduleMonth = () =>
    setRescheduleCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNextRescheduleMonth = () =>
    setRescheduleCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));

  const goPrevSchedMonth = () =>
    setSchedCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNextSchedMonth = () =>
    setSchedCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));

  const saveReschedule = async () => {
    if (!rescheduleTarget) return;
    const dateInvalid = !rescheduleDate.trim();
    const timeInvalid = !isCompleteTime(rescheduleTime, rescheduleMeridiem);
    if (dateInvalid || timeInvalid) {
      setRescheduleFormError({
        date: dateInvalid,
        time: timeInvalid,
        message:
          dateInvalid && timeInvalid
            ? 'Enter a date and a time, including AM or PM.'
            : dateInvalid
              ? 'Enter a date.'
              : 'Enter a time, including AM or PM.',
      });
      return;
    }
    setRescheduleFormError(null);
    const normalizedTime = combineTime(rescheduleTime, rescheduleMeridiem);
    setRescheduling(true);
    await rescheduleShowing(rescheduleTarget.id, rescheduleDate, normalizedTime);
    setShowings(await getShowings());
    setRescheduling(false);
    const client = rescheduleTarget.client;
    setRescheduleTarget(null);
    setSelected(null);
    toast(`Showing with ${client} rescheduled`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, client } = deleteTarget;
    await deleteShowing(id);
    setShowings((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    setDeleteTarget(null);
    toast(`Showing with ${client} removed`);
  };

  // Distinct from Delete: cancelling keeps the showing around for Showing
  // history (it just drops off the live agenda) instead of removing it for
  // good, so this doesn't need Delete's are-you-sure guard.
  const cancelSelectedShowing = async (s: Showing) => {
    await cancelShowing(s.id);
    // "Done" and "Cancelled" are mutually exclusive outcomes — clear a
    // stale completed flag so History doesn't show a cancelled showing as
    // Done just because it happened to be marked done earlier.
    if (completed[s.id]) {
      await setShowingCompleted(s.id, false);
      setCompleted((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
    }
    setShowings((prev) => (prev ? prev.filter((x) => x.id !== s.id) : prev));
    setSelected(null);
    toast(`Showing with ${s.client} cancelled`);
  };

  const saveShowing = async () => {
    const dateInvalid = !schedDate.trim();
    const timeInvalid = !isCompleteTime(schedTime, schedMeridiem);
    const nameInvalid = !schedName.trim();
    const addressInvalid = !schedAddress.trim();
    if (dateInvalid || timeInvalid || nameInvalid || addressInvalid) {
      const missing = [
        dateInvalid && 'date',
        timeInvalid && 'time (with AM/PM)',
        nameInvalid && 'client name',
        addressInvalid && 'address',
      ].filter(Boolean);
      setSchedFormError({
        date: dateInvalid,
        time: timeInvalid,
        name: nameInvalid,
        address: addressInvalid,
        message: `Enter a ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
      });
      return;
    }
    setSchedFormError(null);
    const clientName = schedName.trim();
    setScheduling(true);
    await addShowing({
      date: schedDate,
      time: combineTime(schedTime, schedMeridiem),
      client: schedName,
      address: schedAddress,
      phone: schedPhone || undefined,
      email: schedEmail || undefined,
    });
    setShowings(await getShowings());
    setScheduling(false);
    setSchedOpen(false);
    resetSchedForm();
    toast(`Showing scheduled with ${clientName}`);
  };

  // Re-read settings whenever this tab regains focus (e.g. after the
  // settings modal closes).
  useFocusEffect(
    useCallback(() => {
      getShowingSettings().then(setSettings);
      getSettings().then(setAppSettings);
      // Re-read on every focus, not just on mount — this tab stays mounted
      // in the background when you switch tabs, so a mount-only effect
      // never saw a phone identity added/removed in Shared Access while you
      // were on another tab. Confirmed real bug: adding a second person's
      // number on a real device never made the "send as" dropdown appear
      // back on this tab until a full app reload.
      getPhoneIdentities(user).then(setPhoneIdentities);
      getOutgoingSettings().then((s) => setPhoneIdentityId(s.phoneIdentityId));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  // Whenever the relevant state changes, drop all scheduled reminders and
  // re-schedule fresh ones — cheap since reminders are the only thing this
  // app schedules locally.
  useEffect(() => {
    if (!showings || !settings || !appSettings) return;
    rescheduleShowingReminders(showings, appSettings, settings, user ?? null);
  }, [showings, settings, appSettings, user]);

  const toggleAutoReplies = useCallback(
    async (value: boolean) => {
      setSettings((prev) => (prev ? { ...prev, autoReplies: value } : prev));
      await updateShowingSettings({ autoReplies: value });
      toast(value ? 'Auto reminders ON — texts go out automatically' : 'Auto reminders off');
    },
    [toast]
  );

  useEffect(() => {
    navigation.setOptions({
      // History moved to headerLeft as its own labeled pill — the only tab
      // header with anything in headerLeft, by request — so headerRight is
      // back to its usual 2 icons at the shared sizing every other tab uses.
      headerLeft: () => (
        <Pressable
          onPress={() => router.push('/showings-history')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.historyPill,
            { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
          <Text style={[styles.historyPillLabel, { color: colors.teal }]}>History</Text>
        </Pressable>
      ),
      headerRight: () => (
        <View style={headerRightRow}>
          <Pressable
            onPress={() => router.push('/showings-calendar')}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="calendar-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/showings-settings')}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="settings-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, colors, router]);

  // Multiple clients booked for the same slot (e.g. an open house) share one
  // row — grouped by date + time + address. Each group is a Showing[] (length
  // 1 for a normal solo appointment); renderItem below handles both shapes.
  const sections = useMemo(() => {
    if (!showings) return [];
    const byDate = new Map<string, Showing[]>();
    for (const s of showings) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
    }
    return [...byDate.entries()].map(([date, dayShowings]) => {
      const groups = new Map<string, Showing[]>();
      for (const s of dayShowings) {
        const key = `${s.time}__${s.address}`;
        groups.set(key, [...(groups.get(key) ?? []), s]);
      }
      return { title: dayLabel(date), date, data: [...groups.values()] };
    });
  }, [showings]);

  const confirmViaMessage = async (s: Showing) => {
    if (!s.phone) {
      toast('No phone number saved for this showing', 'error');
      return;
    }
    // Never silently auto-sends: on native this opens the Messages composer
    // pre-filled and the user taps Send themselves; on web it hands off to
    // an sms: link (phone browsers) or copies the message (desktop).
    const firstName = s.client.split(' ')[0];
    const agentName = phoneIdentities.find((i) => i.id === phoneIdentityId)?.label ?? user?.name ?? 'your agent';
    const agentFirst = agentName.split(' ')[0];
    const brokerage = user?.brokerage ?? 'Brooklyn Group';
    const message =
      `Hi ${firstName}, this is ${agentFirst} from ${brokerage} — just confirming ` +
      `your showing ${dayPhrase(s.date)} at ${s.time} for ${s.address}. Reply YES to confirm.`;
    const outcome = await composeSms([s.phone], message);
    if (outcome === 'sent' || outcome === 'copied') {
      if (outcome === 'copied') {
        toast('Message copied — paste it into your texting app.');
      }
      await markShowingSmsSent(s.id);
      setSmsSent((prev) => ({ ...prev, [s.id]: new Date().toISOString() }));
    } else if (outcome === 'unavailable') {
      toast('Texting isn’t available here — simulating the reply instead.', 'warning');
    }
    simulateClientReply(s);
  };

  // TODO: this simulation goes away once inbound SMS replies are real — for
  // now, every "Confirm via iMessage" tap fakes the client's eventual answer
  // after a short delay so all three real-world outcomes (confirmed / no
  // answer / wants to reschedule) can be exercised on demand while testing,
  // the same way simulateIncomingReplies() fakes a lead responding.
  const simulateClientReply = async (s: Showing) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const outcome = await simulateShowingReply(s.id);
    setShowings((prev) => (prev ? prev.map((x) => (x.id === s.id ? { ...x, status: outcome } : x)) : prev));
    const firstName = s.client.split(' ')[0];
    if (outcome === 'confirmed') toast(`${firstName} confirmed`);
    else if (outcome === 'reschedule_requested') toast(`${firstName} asked to reschedule`, 'warning');
    else toast(`No response yet from ${firstName}`);
  };

  // Opens the platform's default maps app directly rather than the
  // Apple/Google chooser units.tsx uses — that chooser lives inside a
  // detail Modal there; this button sits in the inline accordion row, so a
  // direct open keeps it a one-tap action instead of a second UI to build.
  // Defaults to Apple Maps for anything that isn't specifically Android
  // (most of AgentEasy's agents are on iPhone) rather than only using Apple
  // Maps when `Platform.OS` is confirmed 'ios' — the web preview reports
  // 'web', which would otherwise silently fall back to Google Maps.
  const openDirections = (s: Showing) => {
    const encoded = encodeURIComponent(s.address);
    const url =
      Platform.OS === 'android'
        ? `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
        : `http://maps.apple.com/?daddr=${encoded}`;
    Linking.openURL(url).catch(() => toast("Couldn't open Maps", 'error'));
  };

  // Collapsed-row status indicator: an icon instead of a text pill, so the
  // address next to it never has to compete with label text for space.
  // Three distinct shapes (not just filled-vs-outline of the same glyph) so
  // they read apart at a glance: a checkmark shape for "confirmed but not
  // yet done" looked like a second "Done" state, which was confusing.
  // Each returns its own `size` because Ionicons glyphs aren't visually
  // equal at the same font-size — the circular badge icons (checkmark/time/
  // help-circle) are drawn nearly edge-to-edge in their em-square, while
  // calendar has much less internal padding baked into the glyph, so at an
  // identical numeric size it reads noticeably larger despite the DOM boxes
  // measuring the same.
  const statusIcon = (
    completedFlag: boolean,
    status: Showing['status']
  ): { name: keyof typeof Ionicons.glyphMap; color: string; size: number } => {
    if (completedFlag) return { name: 'checkmark-circle', color: colors.teal, size: 19 };
    if (status === 'cancelled') return { name: 'close-circle', color: colors.subtext, size: 19 };
    if (status === 'reschedule_requested') return { name: 'calendar', color: colors.yellow, size: 15 };
    if (status === 'no_answer') return { name: 'help-circle', color: colors.danger, size: 19 };
    // Confirmed but not done yet — same green checkmark-circle as "Done",
    // just unfilled, so completing the showing reads as that same badge
    // simply filling in rather than swapping to an unrelated icon.
    return { name: 'checkmark-circle-outline', color: colors.teal, size: 19 };
  };

  const statusDescription = (completedFlag: boolean, status: Showing['status']): string => {
    if (completedFlag) return 'Done — showing marked complete';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'reschedule_requested') return 'Client asked to reschedule — needs a new time';
    if (status === 'no_answer') return "No answer — client hasn't confirmed";
    return "Confirmed — showing hasn't happened yet";
  };

  const STATUS_LABEL: Record<Showing['status'], string> = {
    confirmed: 'Confirmed',
    no_answer: 'No answer',
    reschedule_requested: 'Reschedule',
    cancelled: 'Cancelled',
  };

  const statusPillColors = (status: Showing['status']) => {
    if (status === 'confirmed') return { color: colors.teal, background: colors.tealSoft };
    if (status === 'cancelled') return { color: colors.subtext, background: colors.cardAlt };
    if (status === 'no_answer') return { color: colors.danger, background: `${colors.danger}1A` };
    return { color: colors.yellow, background: `${colors.yellow}1A` };
  };

  // Tap (or hover, on web) the status icon to see what it means — a small
  // callout above the icon, not a full modal. Auto-dismisses after a couple
  // seconds so it doesn't need a tap-elsewhere-to-close handler.
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimeout = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }
  };

  // Idempotent by design (not a toggle) — Pressable's onPress can fire more
  // than once per tap on web, and a toggle would flip open then immediately
  // closed within that same tap.
  const showTooltip = (key: string) => {
    clearTooltipTimeout();
    setActiveTooltip(key);
  };

  // Tap has no "hover out" to dismiss on, so give it an auto-dismiss timer;
  // real hover relies on onHoverOut instead so it doesn't vanish mid-hover.
  const showTooltipFromPress = (key: string) => {
    showTooltip(key);
    tooltipTimeout.current = setTimeout(() => setActiveTooltip(null), 2500);
  };

  const hideTooltip = () => {
    clearTooltipTimeout();
    setActiveTooltip(null);
  };

  // A merged multi-attendee slot is all one address, so "Get directions" is
  // shared once at the group level (see below) instead of once per person —
  // pulled out so renderAttendeeActions can skip it for that case.
  const renderDirectionsButton = (s: Showing, style?: object) => (
    <Pressable
      onPress={() => openDirections(s)}
      style={({ pressed }) => [
        styles.doneButton,
        { backgroundColor: colors.neutral, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <IconLabel
        icon="navigate"
        iconSize={15}
        color={colors.subtext}
        label="Get directions"
        fontSize={15}
      />
    </Pressable>
  );

  // Shared per-attendee action row (Confirm / Mark as done / View full
  // details) — used for both a solo showing and each person inside a
  // merged multi-attendee slot, so the two cases stay pixel-identical.
  // `showDirections` is false for multi-attendee rows since the group
  // header already renders one shared directions button for the address
  // they all share.
  // Quick-actions row — three equal circular icon buttons (Message /
  // Directions / Mark done) instead of a stack of full-width bars. Mirrors
  // the Call/Text/Email row pattern already used in the Contacts and Units
  // detail cards, so this reads as the same "quick actions" idiom as the
  // rest of the app instead of its own one-off button stack.
  const renderAttendeeActions = (
    s: Showing,
    showDirections = true,
    messageLabel = 'Message',
    detailsLabel = 'View full details'
  ) => (
    <>
      <View style={styles.quickActionsRow}>
        <Pressable
          onPress={() => confirmViaMessage(s)}
          style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.tealSoft }]}>
            <Ionicons name="chatbubble" size={18} color={colors.teal} />
          </View>
          <Text style={[styles.quickActionLabel, { color: colors.teal }]} numberOfLines={1}>
            {messageLabel}
          </Text>
        </Pressable>

        {showDirections && (
          <Pressable
            onPress={() => openDirections(s)}
            style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.neutral }]}>
              <Ionicons name="navigate" size={18} color={colors.text} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.text }]} numberOfLines={1}>
              Directions
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => toggleCompleted(s)}
          style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View
            style={[
              styles.quickActionIcon,
              { backgroundColor: completed[s.id] ? colors.teal : colors.neutral },
            ]}
          >
            <Ionicons
              name={completed[s.id] ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={completed[s.id] ? colors.onTeal : colors.text}
            />
          </View>
          <Text
            style={[
              styles.quickActionLabel,
              { color: completed[s.id] ? colors.teal : colors.text },
            ]}
            numberOfLines={1}
          >
            {completed[s.id] ? 'Done' : 'Mark done'}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => openDetail(s)} style={styles.detailsLink} hitSlop={6}>
        <Text style={[styles.detailsLinkLabel, { color: colors.teal }]}>{detailsLabel}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.teal} />
      </Pressable>
    </>
  );

  if (!showings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <>
    <SectionList
      sections={sections}
      keyExtractor={(group) => group[0].id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal} />
      }
      ListHeaderComponent={
        <>
          <View style={[styles.autoReplyCard, cardShadow, { backgroundColor: colors.card }]}>
            <View style={styles.autoReplyTopRow}>
              <Pressable
                onPress={() => phoneIdentities.length > 1 && setIdentityDropdownOpen((o) => !o)}
                style={{ flex: 1 }}
                hitSlop={4}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.autoReplyLabel, { color: colors.text }]}>
                    Auto-send reminders
                  </Text>
                  {phoneIdentities.length > 1 && (
                    <Ionicons
                      name={identityDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.subtext}
                    />
                  )}
                </View>
                <Text style={[styles.autoReplyHint, { color: colors.faint }]}>
                  Text clients automatically before each showing
                </Text>
              </Pressable>
              <Switch
                value={settings?.autoReplies ?? false}
                onValueChange={toggleAutoReplies}
                trackColor={{ true: colors.teal, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>

            {identityDropdownOpen && phoneIdentities.length > 1 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.autoReplyHint, { color: colors.subtext, marginBottom: 6 }]}>
                  Reminders send as
                </Text>
                {phoneIdentities.map((identity) => {
                  const active = identity.id === phoneIdentityId;
                  return (
                    <Pressable
                      key={identity.id}
                      onPress={async () => {
                        setPhoneIdentityId(identity.id);
                        await updateOutgoingSettings({ phoneIdentityId: identity.id });
                        setIdentityDropdownOpen(false);
                        toast(`Showing reminders now send as ${identity.label}`);
                      }}
                      style={[
                        styles.identityOption,
                        {
                          backgroundColor: active ? colors.tealSoft : colors.cardAlt,
                          borderColor: active ? colors.teal : colors.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.identityLabel,
                            { color: active ? colors.teal : colors.text },
                          ]}
                        >
                          {identity.label}
                        </Text>
                        <Text
                          style={[
                            styles.identitySublabel,
                            { color: active ? colors.teal : colors.subtext },
                          ]}
                        >
                          {identity.sublabel}
                        </Text>
                      </View>
                      {active && (
                        <View style={[styles.identityDot, { backgroundColor: colors.teal }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

        </>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.subtext }]}>No upcoming showings.</Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderRow}>
          <Pill
            label={section.title.toUpperCase()}
            color={colors.teal}
            background={colors.tealSoft}
          />
          {section.data.length > 1 && (
            <Pressable
              onPress={() => router.push(`/route-planner?date=${section.date}`)}
              hitSlop={6}
              style={styles.planRouteLink}
            >
              <Ionicons name="navigate" size={13} color={colors.teal} />
              <Text style={[styles.planRouteLabel, { color: colors.teal }]}>Plan route</Text>
            </Pressable>
          )}
        </View>
      )}
      renderItem={({ item: group, index, section }) => {
        const isLastInSection = index === section.data.length - 1;
        const first = group[0];
        const isMulti = group.length > 1;
        const groupKey = `${first.time}__${first.address}`;
        const isOpen = !!expanded[groupKey];
        const allCompleted = group.every((s) => completed[s.id]);
        // Most-urgent-wins: a reschedule request needs action even if
        // someone else in the group already confirmed; a plain no-answer
        // still outranks a bare confirmed with nothing else going on.
        const groupStatus: Showing['status'] = group.some(
          (s) => s.status === 'reschedule_requested'
        )
          ? 'reschedule_requested'
          : group.some((s) => s.status === 'no_answer')
            ? 'no_answer'
            : 'confirmed';
        const headerCompletedFlag = isMulti ? allCompleted : !!completed[first.id];
        const headerStatus = isMulti ? groupStatus : first.status;
        const headerIcon = statusIcon(headerCompletedFlag, headerStatus);
        const tooltipKey = `status__${groupKey}`;

        return (
          <View style={styles.dayTimelineRow}>
            <View style={styles.timelineRailCol}>
              <View style={[styles.timelineDot, { backgroundColor: colors.teal }]} />
              {!isLastInSection && (
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              )}
            </View>
            <PressableCard
              onPress={() => openGroup(group, groupKey)}
              style={[
                styles.card,
                { flex: 1, marginBottom: 14 },
                allCompleted && { opacity: 0.6 },
              ]}
            >
            <Text style={[styles.cardTimeLabel, { color: colors.faint }]}>{first.time}</Text>
            <View style={styles.headerRow}>
              <View style={styles.timeAddressWrap}>
                <Text style={[styles.timeAddress, { color: colors.text }]} numberOfLines={isOpen ? undefined : 1}>
                  {first.address}
                </Text>
              </View>
              <View style={styles.statusGroup}>
                {isMulti && (
                  <Pill
                    label={`${group.length} guests`}
                    color={colors.teal}
                    background={colors.tealSoft}
                  />
                )}
                {!isMulti && smsSent[first.id] && (
                  <Pill label="Sent" color={colors.teal} background={colors.tealSoft} />
                )}
                <View style={styles.statusIconWrap}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      showTooltipFromPress(tooltipKey);
                    }}
                    onHoverIn={() => showTooltip(tooltipKey)}
                    onHoverOut={hideTooltip}
                    hitSlop={8}
                  >
                    <Ionicons name={headerIcon.name} size={headerIcon.size} color={headerIcon.color} />
                  </Pressable>
                  {activeTooltip === tooltipKey && (
                    <View style={[styles.tooltip, { backgroundColor: colors.text }]}>
                      <Text style={[styles.tooltipText, { color: colors.bg }]}>
                        {statusDescription(headerCompletedFlag, headerStatus)}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.faint}
                />
              </View>
            </View>

            {isOpen && !isMulti && (
              <>
                <Text style={[styles.meta, { color: colors.subtext, marginTop: 10 }]}>
                  <Ionicons name="person-outline" size={13} color={colors.subtext} /> {first.client}
                  {'   '}
                  <Ionicons name="call-outline" size={13} color={colors.teal} />{' '}
                  <Text
                    style={{ color: colors.teal }}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      promptPhone(first.phone, first.client);
                    }}
                  >
                    {formatPhoneDisplay(first.phone)}
                  </Text>
                </Text>
                {renderAttendeeActions(first)}
              </>
            )}

            {isOpen && isMulti && (
              <>
                {/* One shared button — every attendee in this group is
                    viewing the same unit, so directions only need to be
                    offered once rather than once per person. */}
                {renderDirectionsButton(first, { marginTop: 10 })}
                <View style={{ marginTop: 14, gap: 14 }}>
                  {group.map((s) => (
                    <View
                      key={s.id}
                      style={[styles.attendeeCard, cardShadow, { backgroundColor: colors.card }]}
                    >
                      <View style={styles.attendeeHeaderRow}>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            openDetail(s);
                          }}
                          hitSlop={6}
                        >
                          <Text style={[styles.attendeeName, { color: colors.text }]}>
                            <Ionicons name="person-outline" size={13} color={colors.subtext} />{' '}
                            {s.client}
                          </Text>
                        </Pressable>
                        <View style={styles.statusGroup}>
                          {smsSent[s.id] && (
                            <Pill label="Sent" color={colors.teal} background={colors.tealSoft} />
                          )}
                          {completed[s.id] ? (
                            <Pill label="Done" color={colors.teal} background={colors.tealSoft} />
                          ) : (
                            <Pill label={STATUS_LABEL[s.status]} {...statusPillColors(s.status)} />
                          )}
                        </View>
                      </View>
                      <Text
                        style={[styles.meta, { color: colors.teal, marginTop: 3 }]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          promptPhone(s.phone, s.client);
                        }}
                      >
                        <Ionicons name="call-outline" size={13} color={colors.teal} />{' '}
                        {formatPhoneDisplay(s.phone)}
                      </Text>
                      {renderAttendeeActions(s, false, 'Message', 'View details')}
                    </View>
                  ))}
                </View>
              </>
            )}
            </PressableCard>
          </View>
        );
      }}
    />

    <View style={styles.schedFab} pointerEvents="box-none">
      <Pressable
        onPress={() => setSchedOpen(true)}
        style={({ pressed }) => [
          styles.schedFabButton,
          cardShadow,
          { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.onTeal} />
        <Text style={[styles.schedFabLabel, { color: colors.onTeal }]}>Schedule</Text>
      </Pressable>
    </View>

    <Modal
      visible={selected !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setSelected(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
        <Pressable
          style={[styles.detailModalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {selected && (
            <>
              <View style={[styles.detailModalHeader, { backgroundColor: colors.teal }]}>
                <Text style={[styles.detailModalName, { color: colors.onTeal }]}>
                  {selected.address}
                </Text>
                <Text style={[styles.detailModalSubtitle, { color: colors.onTeal }]}>
                  {selected.time} · {shortDayLabel(selected.date)}
                </Text>
                <View style={styles.detailModalPillWrap}>
                  {completed[selected.id] ? (
                    <Pill label="Done" color={colors.teal} background={colors.card} />
                  ) : (
                    <Pill
                      label={STATUS_LABEL[selected.status]}
                      color={statusPillColors(selected.status).color}
                      background={colors.card}
                    />
                  )}
                </View>

                <View style={styles.detailModalMetaList}>
                  <Text style={[styles.detailModalMetaRow, { color: colors.onTeal, fontWeight: '700' }]}>
                    <Ionicons name="person-outline" size={14} color={colors.onTeal} /> {selected.client}
                  </Text>
                  <Text style={[styles.detailModalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="call-outline" size={14} color={colors.onTeal} />{' '}
                    {formatPhoneDisplay(selected.phone)}
                  </Text>

                  {unitLoading ? (
                    <ActivityIndicator
                      color={colors.onTeal}
                      style={{ marginTop: 4, alignSelf: 'flex-start' }}
                    />
                  ) : selectedUnit ? (
                    <>
                      <Text style={[styles.detailModalMetaRow, { color: colors.onTeal }]}>
                        <Ionicons name="pricetag-outline" size={14} color={colors.onTeal} />{' '}
                        ${selectedUnit.grossRent.toLocaleString('en-US')} gross
                        {selectedUnit.netRent !== selectedUnit.grossRent &&
                          ` · $${selectedUnit.netRent.toLocaleString('en-US')} net`}
                      </Text>
                      <Text style={[styles.detailModalMetaRow, { color: colors.onTeal }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.onTeal} />{' '}
                        Move-in from{' '}
                        {new Date(`${selectedUnit.availableFrom}T12:00:00`).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </Text>
                      <Text style={[styles.detailModalMetaRow, { color: colors.onTeal }]}>
                        <Ionicons name="business-outline" size={14} color={colors.onTeal} />{' '}
                        {selectedUnit.neighborhood} ·{' '}
                        {selectedUnit.beds === 0 ? 'Studio' : `${selectedUnit.beds} bed`} /{' '}
                        {selectedUnit.baths} bath
                      </Text>
                      <Text style={[styles.detailModalMetaRow, { color: colors.onTeal }]}>
                        <Ionicons name="key-outline" size={14} color={colors.onTeal} />{' '}
                        {selectedUnit.occupancy}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.detailModalMetaRow, { color: colors.onTeal, opacity: 0.85 }]}>
                      Manually scheduled — no linked unit.
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.detailActionsList}>
                <Pressable
                  onPress={() => {
                    // Close this modal before opening the call-target one —
                    // two native <Modal>s visible at once is unreliable on
                    // real iOS (works fine in the web preview, which is why
                    // this slipped through), same reasoning as Reschedule below.
                    const phone = selected.phone;
                    const name = selected.client;
                    setSelected(null);
                    promptPhone(phone, name);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="call" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]} numberOfLines={1}>
                    Call {selected.client}
                  </Text>
                </Pressable>

                {selectedUnit && (
                  <>
                    <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                    <Pressable
                      onPress={() => Linking.openURL(selectedUnit.streetEasyUrl)}
                      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                        <Ionicons name="open" size={HEADER_ICON_SIZE} color={colors.teal} />
                      </View>
                      <Text style={[styles.actionLabel, { color: colors.teal }]}>View listing</Text>
                    </Pressable>
                  </>
                )}

                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => toggleCompleted(selected)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View
                    style={[
                      styles.actionIconBadge,
                      { backgroundColor: completed[selected.id] ? colors.teal : colors.neutral },
                    ]}
                  >
                    <Ionicons
                      name={completed[selected.id] ? 'checkmark-circle' : 'checkmark-circle-outline'}
                      size={HEADER_ICON_SIZE}
                      color={completed[selected.id] ? colors.onTeal : colors.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: completed[selected.id] ? colors.teal : colors.text },
                    ]}
                  >
                    {completed[selected.id] ? 'Marked as done' : 'Mark as done'}
                  </Text>
                </Pressable>

                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => {
                    const target = selected;
                    setSelected(null);
                    openReschedule(target);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: `${colors.yellow}26` }]}>
                    <Ionicons name="calendar" size={HEADER_ICON_SIZE} color={colors.yellow} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Reschedule</Text>
                </Pressable>

                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => cancelSelectedShowing(selected)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
                    <Ionicons name="close-circle-outline" size={HEADER_ICON_SIZE} color={colors.subtext} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.subtext }]}>Cancel showing</Text>
                </Pressable>

                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => {
                    // Close this modal before opening the delete-confirm one —
                    // two native <Modal>s visible at once is unreliable on
                    // real iOS, same reasoning as Reschedule/call-target above.
                    const target = selected;
                    setSelected(null);
                    setDeleteTarget(target);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </>
          )}

          {selected && (
            <Pressable
              onPress={() => setSelected(null)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.detailModalCloseButton,
                { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={HEADER_ICON_SIZE} color={colors.subtext} />
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={rescheduleTarget !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setRescheduleTarget(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setRescheduleTarget(null)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={(e) => {
            // A tap lands here via bubbling from ANY child that doesn't stop
            // it itself — including a TextInput the user just tapped *into*.
            // Dismissing unconditionally raced focusing that same field: tap
            // to focus, bubble straight into Keyboard.dismiss(), which blurs
            // it again in the same click — the field looked un-clickable on
            // web (confirmed: document.activeElement stayed <body>).
            // Only dismiss for taps that land on something that isn't itself
            // an editable field.
            const tag = (e.target as unknown as HTMLElement)?.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA') Keyboard.dismiss();
          }}
        >
          {rescheduleTarget && rescheduleCalendarOpen && (
            <>
              <View style={styles.monthHeader}>
                <Pressable onPress={goPrevRescheduleMonth} hitSlop={10} style={styles.monthNavButton}>
                  <Ionicons name="chevron-back" size={20} color={colors.teal} />
                </Pressable>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {monthLabel(rescheduleCalendarCursor)}
                </Text>
                <Pressable onPress={goNextRescheduleMonth} hitSlop={10} style={styles.monthNavButton}>
                  <Ionicons name="chevron-forward" size={20} color={colors.teal} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((w, i) => (
                  <Text key={i} style={[styles.weekdayLabel, { color: colors.faint }]}>
                    {w}
                  </Text>
                ))}
              </View>

              {buildMonthGrid(rescheduleCalendarCursor).map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((iso, di) => {
                    if (!iso) return <View key={di} style={styles.dayCell} />;
                    const isSelected = iso.slice(5) === rescheduleDate;
                    const isToday = iso === isoToday();
                    return (
                      <Pressable
                        key={di}
                        onPress={() => {
                          setRescheduleDate(iso.slice(5));
                          setRescheduleCalendarOpen(false);
                        }}
                        style={styles.dayCell}
                      >
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
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <GhostButton
                label="Back"
                onPress={() => setRescheduleCalendarOpen(false)}
                style={{ marginTop: 14 }}
              />
            </>
          )}

          {rescheduleTarget && !rescheduleCalendarOpen && (
            <>
              <Text style={[styles.schedTitle, { color: colors.text }]}>
                Reschedule {rescheduleTarget.client}
              </Text>

              <View style={styles.schedRow}>
                <View style={styles.schedHalf}>
                  <Text style={[styles.schedLabel, { color: colors.subtext }]}>Date</Text>
                  <TextInput
                    style={[
                      styles.schedInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: rescheduleFormError?.date ? colors.danger : colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={rescheduleDate}
                    onChangeText={(t) => {
                      setRescheduleDate(t);
                      if (rescheduleFormError) setRescheduleFormError(null);
                    }}
                    placeholder="MM-DD"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setRescheduleCalendarOpen(true)}
                    style={({ pressed }) => [
                      styles.calendarPickerButton,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <IconLabel
                      icon="calendar-outline"
                      iconSize={14}
                      color={colors.teal}
                      label="Calendar"
                      fontSize={12.5}
                    />
                  </Pressable>
                </View>
                <View style={styles.schedHalf}>
                  <Text style={[styles.schedLabel, { color: colors.subtext }]}>Time</Text>
                  <TextInput
                    style={[
                      styles.schedInput,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: rescheduleFormError?.time ? colors.danger : colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={rescheduleTime}
                    onChangeText={(raw) => {
                      setRescheduleTime(formatTimeTyped(raw));
                      if (rescheduleFormError) setRescheduleFormError(null);
                    }}
                    onFocus={() => {
                      if (rescheduleTimeClearedRef.current) return;
                      rescheduleTimeClearedRef.current = true;
                      // Clearing synchronously inside the native focus event
                      // can race with the browser/webview's own focus
                      // handling — sometimes fine, sometimes it steals focus
                      // right back off the field before the keyboard/typing
                      // can land. Deferring one tick lets focus settle first.
                      setTimeout(() => {
                        setRescheduleTime('');
                        setRescheduleMeridiem(null);
                      }, 0);
                    }}
                    placeholder="5:30"
                    placeholderTextColor={colors.faint}
                    keyboardType="number-pad"
                  />
                  <View style={styles.meridiemRow}>
                    {(['AM', 'PM'] as const).map((m) => {
                      const active = rescheduleMeridiem === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setRescheduleMeridiem(m);
                            if (rescheduleFormError) setRescheduleFormError(null);
                          }}
                          style={[
                            styles.meridiemButton,
                            {
                              backgroundColor: active ? colors.teal : colors.cardAlt,
                              borderColor: active ? colors.teal : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.meridiemLabel,
                              { color: active ? colors.onTeal : colors.subtext },
                            ]}
                          >
                            {m}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.schedActions}>
                <GhostButton
                  label="Cancel"
                  onPress={() => setRescheduleTarget(null)}
                  style={styles.schedButton}
                />
                <PrimaryButton
                  label={rescheduling ? 'Saving…' : 'Save'}
                  onPress={saveReschedule}
                  style={styles.schedButton}
                />
              </View>
              {rescheduleFormError && (
                <Text style={[styles.fieldError, { color: colors.danger }]}>
                  {rescheduleFormError.message}
                </Text>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={deleteTarget !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setDeleteTarget(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setDeleteTarget(null)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {deleteTarget && (
            <>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>
                Delete this showing?
              </Text>
              <Text style={[styles.confirmBody, { color: colors.subtext }]}>
                {deleteTarget.client}'s showing at {deleteTarget.address} will be permanently
                removed from your schedule.
              </Text>
              <View style={styles.confirmActions}>
                <GhostButton
                  label="Cancel"
                  onPress={() => setDeleteTarget(null)}
                  style={styles.confirmButton}
                />
                <Pressable
                  onPress={confirmDelete}
                  style={({ pressed }) => [
                    styles.confirmDangerButton,
                    { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.confirmDangerLabel}>Delete</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={schedOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setSchedOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSchedOpen(false)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={(e) => {
            // A tap lands here via bubbling from ANY child that doesn't stop
            // it itself — including a TextInput the user just tapped *into*.
            // Dismissing unconditionally raced focusing that same field: tap
            // to focus, bubble straight into Keyboard.dismiss(), which blurs
            // it again in the same click — the field looked un-clickable on
            // web (confirmed: document.activeElement stayed <body>).
            // Only dismiss for taps that land on something that isn't itself
            // an editable field.
            const tag = (e.target as unknown as HTMLElement)?.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA') Keyboard.dismiss();
          }}
        >
          {schedCalendarOpen && (
            <>
              <View style={styles.monthHeader}>
                <Pressable onPress={goPrevSchedMonth} hitSlop={10} style={styles.monthNavButton}>
                  <Ionicons name="chevron-back" size={20} color={colors.teal} />
                </Pressable>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {monthLabel(schedCalendarCursor)}
                </Text>
                <Pressable onPress={goNextSchedMonth} hitSlop={10} style={styles.monthNavButton}>
                  <Ionicons name="chevron-forward" size={20} color={colors.teal} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((w, i) => (
                  <Text key={i} style={[styles.weekdayLabel, { color: colors.faint }]}>
                    {w}
                  </Text>
                ))}
              </View>

              {buildMonthGrid(schedCalendarCursor).map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((iso, di) => {
                    if (!iso) return <View key={di} style={styles.dayCell} />;
                    const isSelected = iso.slice(5) === schedDate;
                    const isToday = iso === isoToday();
                    return (
                      <Pressable
                        key={di}
                        onPress={() => {
                          setSchedDate(iso.slice(5));
                          setSchedCalendarOpen(false);
                        }}
                        style={styles.dayCell}
                      >
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
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <GhostButton
                label="Back"
                onPress={() => setSchedCalendarOpen(false)}
                style={{ marginTop: 14 }}
              />
            </>
          )}

          {!schedCalendarOpen && (
            <>
          <View style={styles.schedHeaderRow}>
            <Text style={[styles.schedTitle, { color: colors.text }]}>New showing</Text>
            <Pressable
              onPress={resetSchedForm}
              hitSlop={8}
              style={({ pressed }) => [styles.schedClearButton, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.schedClearLabel, { color: colors.teal }]}>Clear</Text>
            </Pressable>
          </View>

          <View style={styles.schedRow}>
            <View style={styles.schedHalf}>
              <Text style={[styles.schedLabel, { color: colors.subtext }]}>Date</Text>
              <TextInput
                style={[
                  styles.schedInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: schedFormError?.date ? colors.danger : colors.border,
                    color: colors.text,
                  },
                ]}
                value={schedDate}
                onChangeText={(t) => {
                  setSchedDate(t);
                  if (schedFormError) setSchedFormError(null);
                }}
                placeholder="MM-DD"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setSchedCalendarOpen(true)}
                style={({ pressed }) => [
                  styles.calendarPickerButton,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <IconLabel
                  icon="calendar-outline"
                  iconSize={14}
                  color={colors.teal}
                  label="Calendar"
                  fontSize={12.5}
                />
              </Pressable>
            </View>
            <View style={styles.schedHalf}>
              <Text style={[styles.schedLabel, { color: colors.subtext }]}>Time</Text>
              <TextInput
                style={[
                  styles.schedInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: schedFormError?.time ? colors.danger : colors.border,
                    color: colors.text,
                  },
                ]}
                value={schedTime}
                onChangeText={(raw) => {
                  setSchedTime(formatTimeTyped(raw));
                  if (schedFormError) setSchedFormError(null);
                }}
                placeholder="5:30"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
              />
              <View style={styles.meridiemRow}>
                {(['AM', 'PM'] as const).map((m) => {
                  const active = schedMeridiem === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setSchedMeridiem(m);
                        if (schedFormError) setSchedFormError(null);
                      }}
                      style={[
                        styles.meridiemButton,
                        {
                          backgroundColor: active ? colors.teal : colors.cardAlt,
                          borderColor: active ? colors.teal : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.meridiemLabel,
                          { color: active ? colors.onTeal : colors.subtext },
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Text style={[styles.schedLabel, { color: colors.subtext, marginTop: 12 }]}>
            Client name
          </Text>
          <TextInput
            style={[
              styles.schedInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: schedFormError?.name ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
            value={schedName}
            onChangeText={(t) => {
              setSchedName(capitalizeWords(t));
              if (schedFormError) setSchedFormError(null);
            }}
            placeholder="e.g. Maya Rosenberg"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
          />
          {renderSuggestions(nameSuggestions)}

          <Text style={[styles.schedLabel, { color: colors.subtext, marginTop: 12 }]}>
            Address
          </Text>
          <TextInput
            style={[
              styles.schedInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: schedFormError?.address ? colors.danger : colors.border,
                color: colors.text,
              },
            ]}
            value={schedAddress}
            onChangeText={(t) => {
              setSchedAddress(t);
              if (schedFormError) setSchedFormError(null);
            }}
            placeholder="e.g. 212 Bedford Ave #3F"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
          />
          {renderSuggestions(addressSuggestions)}

          <Text style={[styles.schedLabel, { color: colors.subtext, marginTop: 12 }]}>
            Phone (optional — needed for iMessage confirmations)
          </Text>
          <TextInput
            style={[
              styles.schedInput,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            value={schedPhone}
            onChangeText={setSchedPhone}
            placeholder="(917) 555-0100"
            placeholderTextColor={colors.faint}
            keyboardType="phone-pad"
          />
          {renderSuggestions(phoneSuggestions)}

          <Text style={[styles.schedLabel, { color: colors.subtext, marginTop: 12 }]}>
            Email (optional)
          </Text>
          <TextInput
            style={[
              styles.schedInput,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            value={schedEmail}
            onChangeText={setSchedEmail}
            placeholder="e.g. maya.rosenberg@gmail.com"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {renderSuggestions(emailSuggestions)}

          <View style={styles.schedActions}>
            <GhostButton
              label="Cancel"
              onPress={() => setSchedOpen(false)}
              style={styles.schedButton}
            />
            <PrimaryButton
              label={scheduling ? 'Scheduling…' : 'Schedule'}
              onPress={saveShowing}
              style={styles.schedButton}
            />
          </View>
          {schedFormError && (
            <Text style={[styles.fieldError, { color: colors.danger }]}>
              {schedFormError.message}
            </Text>
          )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Extra bottom padding clears the floating "Schedule a showing" pill so
  // the last card in the list is never hidden behind it.
  list: { padding: 18, paddingBottom: 100 },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    gap: 6,
    marginLeft: 16,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  historyPillLabel: { fontSize: 15, fontWeight: '700' },
  // bottom: 0 (not insets.bottom) — the tab bar already consumes the
  // device's home-indicator safe area, so adding insets.bottom here double
  // counted it and left the pill floating well above the tab bar.
  schedFab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 12,
  },
  schedFabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  schedFabLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  autoReplyCard: {
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
  },
  autoReplyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoReplyLabel: { fontSize: 15, fontWeight: '700' },
  autoReplyHint: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  planRouteLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planRouteLabel: { fontSize: 12.5, fontWeight: '700' },
  card: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Fixed box (not just the bare icon) — different glyphs (checkmark vs.
  // clock vs. question mark) have different natural widths at the same font
  // size, which was shifting the icon/chevron left-right row to row. Centering
  // each glyph inside an identical-width box pins them to the same spot.
  statusIconWrap: { position: 'relative', width: 22, alignItems: 'center' },
  tooltip: {
    position: 'absolute',
    bottom: 26,
    right: -8,
    width: 172,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  tooltipText: { fontSize: 11.5, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  timeAddressWrap: { flex: 1, marginRight: 10 },
  timeAddress: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1, lineHeight: 20 },
  meta: { fontSize: 13, marginTop: 5 },
  // Timeline rail v2 — a constant, always-visible line + dot per showing (not
  // conditional on expand state), so a whole day reads as one continuous
  // sequence at a glance, calendar-agenda style. The time itself moved off
  // the rail and into the card as a small caption above the address — this
  // removes the pill-vs-line alignment juggling of the previous version
  // entirely, since the rail no longer has to line up with anything but
  // itself. The card-to-card gap lives on the card (not this row) so the
  // rail — stretched to match via alignItems: 'stretch' — includes that gap
  // in its own height too, letting the line run through it to the next dot.
  dayTimelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRailCol: { width: 20, alignItems: 'center', marginRight: 12 },
  timelineDot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 24 },
  timelineLine: { flex: 1, width: 2, marginTop: 6, marginBottom: -18 },
  cardTimeLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  attendeeCard: { borderRadius: radius.card, padding: 14 },
  attendeeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attendeeName: { fontSize: 14.5, fontWeight: '700' },
  smsLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.button,
    paddingVertical: 13,
    marginTop: 8,
  },
  // Quick-actions row — see renderAttendeeActions.
  quickActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 12, fontWeight: '600' },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 3,
    marginTop: 12,
    padding: 4,
  },
  detailsLinkLabel: { fontSize: 13, fontWeight: '700' },
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
  // Showing detail card — same shape as the Contacts/Units detail cards
  // (teal banner header with a floating close button, then a flat
  // action-row list below) so all three "detail popup" surfaces in the app
  // read as one consistent idiom.
  detailModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  detailModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalHeader: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  detailModalName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  detailModalSubtitle: { fontSize: 13, marginTop: 3, opacity: 0.85 },
  detailModalPillWrap: { alignSelf: 'center', marginTop: 8 },
  detailModalMetaList: { alignSelf: 'stretch', marginTop: 18, gap: 8 },
  detailModalMetaRow: { fontSize: 13.5 },
  detailActionsList: { paddingHorizontal: 20, paddingVertical: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  actionIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionDivider: { height: 1, marginLeft: 34 },
  schedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  schedTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  schedClearButton: { paddingVertical: 2, paddingHorizontal: 2 },
  schedClearLabel: { fontSize: 14, fontWeight: '600' },
  schedRow: { flexDirection: 'row', gap: 10 },
  schedHalf: { flex: 1 },
  schedLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  schedInput: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  schedActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  schedButton: { flex: 1 },
  fieldError: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  meridiemRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  meridiemButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: 8,
  },
  meridiemLabel: { fontSize: 12.5, fontWeight: '700' },
  calendarPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: 8,
    marginTop: 6,
  },
  calendarPickerLabel: { fontSize: 12.5, fontWeight: '700' },
  confirmTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  confirmBody: { fontSize: 14, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmButton: { flex: 1 },
  confirmDangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavButton: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontSize: 13.5, fontWeight: '600' },
  identityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  identityLabel: { fontSize: 15, fontWeight: '600' },
  identitySublabel: { fontSize: 12.5, marginTop: 2 },
  identityDot: { width: 8, height: 8, borderRadius: 4 },
  suggestions: {
    borderWidth: 1,
    borderRadius: radius.input,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionText: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '700' },
  suggestionMeta: { fontSize: 12, marginTop: 1 },
});
