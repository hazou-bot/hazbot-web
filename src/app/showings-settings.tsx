import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addShowingsToCalendar,
  DEFAULT_REMINDER_TEMPLATE,
  getOutgoingSettings,
  getShowingSettings,
  updateOutgoingSettings,
  updateShowingSettings,
} from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel, PrimaryButton } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { Identity, getPhoneIdentities } from '../identities';
import { cardShadow, radius, useTheme } from '../theme';
import { OutgoingSettings, ShowingSettings } from '../types';

/**
 * Same four icon/color/label combinations as statusIcon()/STATUS_LABEL in
 * (tabs)/showings.tsx — kept as a plain reference list here rather than
 * imported, since that logic also needs live `completed`/`status` values to
 * pick a variant, which doesn't apply to a static legend.
 */
const STATUS_KEY: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: 'teal' | 'yellow' | 'danger' | 'subtext';
  label: string;
  description: string;
}> = [
  {
    icon: 'checkmark-circle-outline',
    colorKey: 'teal',
    label: 'Confirmed',
    description: "Showing hasn't happened yet",
  },
  {
    icon: 'checkmark-circle',
    colorKey: 'teal',
    label: 'Done',
    description: 'Showing marked complete',
  },
  {
    icon: 'calendar',
    colorKey: 'yellow',
    label: 'Reschedule',
    description: 'Client asked to reschedule — needs a new time',
  },
  {
    icon: 'help-circle',
    colorKey: 'danger',
    label: 'No answer',
    description: "Client hasn't confirmed",
  },
  {
    icon: 'close-circle',
    colorKey: 'subtext',
    label: 'Cancelled',
    description: 'Removed from your live agenda, kept in Showing history',
  },
];

/** Discrete slider stops, in minutes: 5 min → 6 hours. */
const STOPS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360];

/** One-tap presets for the most commonly used lead times. */
const QUICK_PICKS = [15, 30, 60, 120, 360];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hr`;
}

function nearestStopIndex(mins: number): number {
  let best = 0;
  for (let i = 0; i < STOPS.length; i++) {
    if (Math.abs(STOPS[i] - mins) < Math.abs(STOPS[best] - mins)) best = i;
  }
  return best;
}

export default function ShowingsSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [settings, setSettings] = useState<ShowingSettings | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState('');
  const [addingTo, setAddingTo] = useState<'apple' | 'google' | null>(null);
  const [phoneIdentities, setPhoneIdentities] = useState<Identity[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingSettings | null>(null);
  // Mirrors settings.reminderMinutes but updates continuously while dragging
  // (onValueChange), not just on release — settings itself only updates on
  // release/quick-pick so we're not hitting the API on every frame of the drag.
  const [sliderIndex, setSliderIndex] = useState(0);
  // Same live-while-dragging mirror as sliderIndex above, for the history
  // retention slider — 1–7 is already a plain integer range, no log-scale
  // stops array needed the way the minutes slider has.
  const [historyDays, setHistoryDays] = useState(7);

  // Focus-driven, not mount-only — this screen can be reached, backgrounded
  // (e.g. while adding a person's phone number in Shared Access), and
  // returned to without a real remount in some navigation paths, so a
  // mount-only fetch could show a stale phone-identity list.
  useFocusEffect(
    useCallback(() => {
      getShowingSettings().then((s) => {
        setSettings(s);
        setSliderIndex(nearestStopIndex(s.reminderMinutes));
        setHistoryDays(s.historyRetentionDays);
      });
      getPhoneIdentities(user).then(setPhoneIdentities);
      getOutgoingSettings().then(setOutgoing);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  useEffect(() => {
    if (settings) setSliderIndex(nearestStopIndex(settings.reminderMinutes));
  }, [settings?.reminderMinutes]);

  useEffect(() => {
    if (settings) setHistoryDays(settings.historyRetentionDays);
  }, [settings?.historyRetentionDays]);

  if (!settings || !outgoing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const applyReminder = async (reminderMinutes: number) => {
    setSettings({ ...settings, reminderMinutes });
    await updateShowingSettings({ reminderMinutes });
  };

  // Exclusive by construction, same as Leads' "Reply from" — selecting one
  // identity always flips the other switch off, no independent multi-select.
  const selectReminderIdentity = async (id: string) => {
    setOutgoing({ ...outgoing, phoneIdentityId: id });
    await updateOutgoingSettings({ phoneIdentityId: id });
    const identity = phoneIdentities.find((i) => i.id === id);
    toast(`Showing reminders now send as ${identity?.label}`);
  };

  const setReminderFromSlider = (index: number) => applyReminder(STOPS[Math.round(index)]);

  const applyHistoryDays = async (days: number) => {
    setSettings({ ...settings, historyRetentionDays: days });
    await updateShowingSettings({ historyRetentionDays: days });
  };

  // The Slider's own `value` must stay pinned to the last *committed* stop —
  // feeding it the live drag position (sliderIndex) fought the native gesture
  // recognizer and made the slider feel unresponsive / drop touches mid-drag.
  // sliderIndex still drives the pill + tick display so those track live.
  const committedIndex = nearestStopIndex(settings.reminderMinutes);

  const openEditor = () => {
    setDraftTemplate(settings.reminderTemplate);
    setEditorOpen(true);
  };

  const saveTemplate = async () => {
    const reminderTemplate = draftTemplate.trim() || DEFAULT_REMINDER_TEMPLATE;
    setSettings({ ...settings, reminderTemplate });
    await updateShowingSettings({ reminderTemplate });
    setEditorOpen(false);
    toast('Reminder text saved');
  };

  const addToCalendar = async (provider: 'apple' | 'google') => {
    setAddingTo(provider);
    const { added } = await addShowingsToCalendar(provider);
    setAddingTo(null);
    toast(`${added} showings added to ${provider === 'apple' ? 'Apple' : 'Google'} Calendar`);
  };

  const preview = settings.reminderTemplate
    .replaceAll('[name]', 'Maya')
    .replaceAll('[agent]', (user?.name ?? 'Agent').split(' ')[0])
    .replaceAll('[brokerage]', user?.brokerage ?? 'Brooklyn Group')
    .replaceAll('[time]', '5:30 PM')
    .replaceAll('[address]', '212 Bedford Ave #3F');

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Reminder timing</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.reminderHeaderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>
            Text the client before each showing
          </Text>
          <Pill
            label={formatMinutes(STOPS[sliderIndex])}
            color={colors.teal}
            background={colors.tealSoft}
            style={styles.valuePillFixedWidth}
          />
        </View>

        <View style={[styles.sliderTrackWrap, { backgroundColor: colors.cardAlt }]}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={STOPS.length - 1}
            step={1}
            value={committedIndex}
            onValueChange={(index) => setSliderIndex(Math.round(index))}
            onSlidingComplete={setReminderFromSlider}
            minimumTrackTintColor={colors.teal}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.teal}
          />
          <View style={styles.tickRow} pointerEvents="none">
            {STOPS.map((stop, i) => (
              <View
                key={stop}
                style={[
                  styles.tick,
                  {
                    backgroundColor: i <= sliderIndex ? colors.teal : colors.border,
                  },
                  i === sliderIndex && styles.tickActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.sliderScale}>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>5 min</Text>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>6 hr</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.quickPickLabel, { color: colors.faint }]}>Quick pick</Text>
        <View style={styles.quickPickRow}>
          {QUICK_PICKS.map((mins) => {
            const active = settings.reminderMinutes === mins;
            return (
              <Pressable
                key={mins}
                onPress={() => applyReminder(mins)}
                style={[
                  styles.quickPickChip,
                  {
                    backgroundColor: active ? colors.teal : colors.cardAlt,
                    borderColor: active ? colors.teal : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.quickPickChipLabel,
                    { color: active ? colors.onTeal : colors.subtext },
                  ]}
                >
                  {formatMinutes(mins)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.hint, { color: colors.faint }]}>
          Showings still marked "No answer" at this point get a "might need
          rescheduling" nudge instead of the reminder text below.
        </Text>
      </View>

      {phoneIdentities.length > 1 && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Reminders from</Text>
          <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
            {phoneIdentities.map((identity, i) => {
              const active = outgoing.phoneIdentityId === identity.id;
              return (
                <View key={identity.id}>
                  {i > 0 && <View style={[styles.identityDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.identityRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderLabel, { color: colors.text }]}>
                        {identity.label}
                      </Text>
                      <Text style={[styles.identitySublabel, { color: colors.subtext }]}>
                        {identity.sublabel}
                      </Text>
                    </View>
                    <Switch
                      value={active}
                      onValueChange={() => selectReminderIdentity(identity.id)}
                      trackColor={{ true: colors.teal, false: colors.border }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              );
            })}
            <Text style={[styles.hint, { color: colors.faint }]}>
              Exactly one number sends showing reminders at a time — switching one on
              switches the other off.
            </Text>
          </View>
        </>
      )}

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Reminder text</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <Text style={[styles.previewLabel, { color: colors.faint }]}>Preview</Text>
        <View style={[styles.previewBubble, { backgroundColor: colors.tealSoft }]}>
          <Text style={[styles.previewText, { color: colors.text }]}>{preview}</Text>
        </View>
        <Pressable
          onPress={openEditor}
          style={({ pressed }) => [
            styles.editRow,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconLabel
            icon="create-outline"
            iconSize={17}
            color={colors.teal}
            label="Edit reminder text"
            fontSize={14}
            fontWeight="600"
          />
        </Pressable>
        <Text style={[styles.hint, { color: colors.faint }]}>
          Placeholders: [name] [agent] [brokerage] [time] [address]
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Calendar</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <Text style={[styles.calendarBody, { color: colors.subtext }]}>
          Add your upcoming showings as calendar events with the client, address, and time.
        </Text>
        <Pressable
          onPress={() => addToCalendar('apple')}
          disabled={addingTo !== null}
          style={({ pressed }) => [
            styles.calendarButton,
            { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconLabel
            leading={
              addingTo === 'apple' ? <ActivityIndicator size="small" color={colors.teal} /> : undefined
            }
            icon="logo-apple"
            iconSize={18}
            color={colors.text}
            label="Add to Apple Calendar"
            fontSize={15}
            fontWeight="600"
          />
        </Pressable>
        <Pressable
          onPress={() => addToCalendar('google')}
          disabled={addingTo !== null}
          style={({ pressed }) => [
            styles.calendarButton,
            { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconLabel
            leading={
              addingTo === 'google' ? <ActivityIndicator size="small" color={colors.teal} /> : undefined
            }
            icon="logo-google"
            iconSize={17}
            iconColor={colors.amber}
            color={colors.text}
            label="Add to Google Calendar"
            fontSize={15}
            fontWeight="600"
          />
        </Pressable>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Showing history</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.reminderHeaderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>Keep past showings for</Text>
          <Pill
            label={`${historyDays} day${historyDays === 1 ? '' : 's'}`}
            color={colors.teal}
            background={colors.tealSoft}
            style={styles.valuePillFixedWidth}
          />
        </View>

        <View style={[styles.sliderTrackWrap, { backgroundColor: colors.cardAlt }]}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={7}
            step={1}
            value={settings.historyRetentionDays}
            onValueChange={(v) => setHistoryDays(Math.round(v))}
            onSlidingComplete={(v) => applyHistoryDays(Math.round(v))}
            minimumTrackTintColor={colors.teal}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.teal}
          />
          <View style={styles.tickRow} pointerEvents="none">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <View
                key={day}
                style={[
                  styles.tick,
                  { backgroundColor: day <= historyDays ? colors.teal : colors.border },
                  day === historyDays && styles.tickActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.sliderScale}>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>1 day</Text>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>7 days</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Pressable
          onPress={() => router.push('/showings-history')}
          style={({ pressed }) => [
            styles.editRow,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconLabel
            icon="time-outline"
            iconSize={17}
            color={colors.teal}
            label="View showing history"
            fontSize={14}
            fontWeight="600"
          />
        </Pressable>
        <Text style={[styles.hint, { color: colors.faint }]}>
          Once a showing's date has passed — or it's cancelled — it moves here instead of the
          live agenda. Raising the day count doesn't lose anything you already had.
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Status icons</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        {STATUS_KEY.map((item, i) => (
          <View key={item.label}>
            {i > 0 && <View style={[styles.identityDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.keyRow}>
              <View style={styles.keyIconSlot}>
                <Ionicons name={item.icon} size={19} color={colors[item.colorKey]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reminderLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.identitySublabel, { color: colors.subtext }]}>
                  {item.description}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit reminder text</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={draftTemplate}
              onChangeText={setDraftTemplate}
              multiline
              autoFocus
              placeholder={DEFAULT_REMINDER_TEMPLATE}
              placeholderTextColor={colors.faint}
            />
            <Text style={[styles.hint, { color: colors.faint }]}>
              Placeholders: [name] [agent] [brokerage] [time] [address]
            </Text>
            <View style={styles.modalActions}>
              <GhostButton
                label="Cancel"
                onPress={() => setEditorOpen(false)}
                style={styles.modalButton}
              />
              <PrimaryButton label="Save" onPress={saveTemplate} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reminderLabel: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  keyIconSlot: { width: 22, alignItems: 'center' },
  identitySublabel: { fontSize: 12.5, marginTop: 2 },
  identityDivider: { height: 1, marginVertical: 2 },
  // Fixed width (sized for the longest value, "45 min") so the pill never
  // resizes as the slider moves — keeps the label's available width (and
  // therefore its line-wrapping) constant across every stop instead of
  // reflowing between one and two lines depending on the current value.
  valuePillFixedWidth: { minWidth: 66, alignItems: 'center' },
  sliderTrackWrap: {
    borderRadius: radius.card,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    marginTop: 16,
  },
  slider: { width: '100%', height: 36 },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: -6,
    marginBottom: 8,
  },
  tick: { width: 4, height: 4, borderRadius: 2 },
  tickActive: { width: 6, height: 6, borderRadius: 3 },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scaleLabel: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, marginVertical: 16 },
  quickPickLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  quickPickRow: { flexDirection: 'row', gap: 8 },
  quickPickChip: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
  },
  quickPickChipLabel: { fontSize: 13, fontWeight: '700' },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  previewBubble: {
    borderRadius: radius.card,
    borderBottomLeftRadius: 6,
    padding: 12,
  },
  previewText: { fontSize: 14, lineHeight: 20 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 10,
    marginTop: 12,
  },
  editLabel: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  calendarBody: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
    marginTop: 10,
  },
  calendarLabel: { fontSize: 15, fontWeight: '600' },
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
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalButton: { flex: 1 },
});
