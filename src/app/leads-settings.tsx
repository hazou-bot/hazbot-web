import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DEFAULT_LEAD_SCRIPT,
  getEmailConnection,
  getLeadReplyScript,
  getSettings,
  scanInbox,
  updateLeadReplyScript,
  updateSettings,
} from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel, PrimaryButton } from '../components/buttons';
import { computeLiveStatus, liveStatusLabel, LiveStatusDot } from '../components/liveStatusDot';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { sendLeadReplyNotification } from '../notifications';
import { cardShadow, radius, useTheme } from '../theme';
import { AppSettings, EmailConnection } from '../types';

/** Discrete slider stops, in minutes: instant → 1 hour. */
const DELAY_STOPS = [0, 1, 2, 5, 10, 15, 30, 45, 60];

/** One-tap presets for the most commonly used delays. */
const DELAY_QUICK_PICKS = [0, 1, 5, 15, 30];

function formatDelay(mins: number): string {
  if (mins === 0) return 'Instant';
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hr`;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function nearestDelayStopIndex(mins: number): number {
  let best = 0;
  for (let i = 0; i < DELAY_STOPS.length; i++) {
    if (Math.abs(DELAY_STOPS[i] - mins) < Math.abs(DELAY_STOPS[best] - mins)) best = i;
  }
  return best;
}

export default function LeadsSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { user } = useSession();
  const [script, setScript] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // Mirrors settings.autoReplyDelayMinutes but updates continuously while dragging
  // (onValueChange), not just on release — settings itself only updates on
  // release/quick-pick so we're not hitting the API on every frame of the drag.
  const [sliderIndex, setSliderIndex] = useState(0);
  // Same live-while-dragging mirror as sliderIndex above, for the history
  // retention slider.
  const [historyDays, setHistoryDays] = useState(7);
  const [connection, setConnection] = useState<EmailConnection | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getLeadReplyScript().then(setScript);
    getSettings().then((s) => {
      setSettings(s);
      setSliderIndex(nearestDelayStopIndex(s.autoReplyDelayMinutes));
      setHistoryDays(s.leadHistoryRetentionDays);
    });
    getEmailConnection().then(setConnection);
  }, [user]);

  useEffect(() => {
    if (settings) setSliderIndex(nearestDelayStopIndex(settings.autoReplyDelayMinutes));
  }, [settings?.autoReplyDelayMinutes]);

  useEffect(() => {
    if (settings) setHistoryDays(settings.leadHistoryRetentionDays);
  }, [settings?.leadHistoryRetentionDays]);

  if (script === null || settings === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const openEditor = () => {
    setDraft(script);
    setEditorOpen(true);
  };

  const save = async () => {
    const next = draft.trim() || DEFAULT_LEAD_SCRIPT;
    setScript(next);
    await updateLeadReplyScript(next);
    setEditorOpen(false);
    toast('Lead reply script saved');
  };

  const applyDelay = async (autoReplyDelayMinutes: number) => {
    setSettings({ ...settings, autoReplyDelayMinutes });
    await updateSettings({ autoReplyDelayMinutes });
  };

  const applyHistoryDays = async (leadHistoryRetentionDays: number) => {
    setSettings({ ...settings, leadHistoryRetentionDays });
    await updateSettings({ leadHistoryRetentionDays });
  };

  const refreshInbox = async () => {
    if (!connection || scanning) return;
    setScanning(true);
    const result = await scanInbox();
    await getEmailConnection().then(setConnection);
    setScanning(false);
    if (result.newReplies.length > 0) {
      await sendLeadReplyNotification(result.newReplies.map((r) => r.name), settings);
      const [first] = result.newReplies;
      toast(
        result.newReplies.length === 1
          ? `${first.name} replied`
          : `${result.newReplies.length} leads replied`
      );
    } else {
      toast(
        `Checked your inbox — ${result.scannedEmails} emails scanned, ${result.leadsImported} leads up to date`
      );
    }
  };

  // The Slider's own `value` must stay pinned to the last *committed* stop —
  // feeding it the live drag position (sliderIndex) fought the native gesture
  // recognizer and made the slider feel unresponsive / drop touches mid-drag.
  // sliderIndex still drives the pill + tick display so those track live.
  const committedIndex = nearestDelayStopIndex(settings.autoReplyDelayMinutes);

  const preview = script
    .replaceAll('[name]', 'Maya')
    .replaceAll('[listing]', '212 Bedford Ave #3F')
    .replaceAll('[agent]', (user?.name ?? 'Agent').split(' ')[0])
    .replaceAll('[brokerage]', user?.brokerage ?? 'Brooklyn Group');

  const liveStatus = computeLiveStatus(!!connection, connection?.lastScanAt ?? null, scanning);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }, styles.firstSectionHeader]}>
        Live status
      </Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.statusRow}>
          <LiveStatusDot status={liveStatus} size={12} />
          <View style={styles.statusTextCol}>
            <Text style={[styles.statusHeadline, { color: colors.text }]}>
              {liveStatusLabel(liveStatus)}
            </Text>
            <Text style={[styles.hint, { marginTop: 2 }, { color: colors.faint }]}>
              {scanning
                ? 'Checking your inbox for new leads…'
                : connection
                ? connection.lastScanAt
                  ? `Inbox connected — last synced ${timeAgo(connection.lastScanAt)}.`
                  : 'Inbox connected — not scanned yet.'
                : 'No inbox connected — new leads won’t come in.'}
            </Text>
          </View>
          {connection && (
            <Pressable
              onPress={refreshInbox}
              disabled={scanning}
              hitSlop={8}
              style={({ pressed }) => [
                styles.refreshButton,
                { backgroundColor: colors.tealSoft, opacity: pressed || scanning ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="refresh" size={18} color={colors.teal} />
            </Pressable>
          )}
        </View>
        {!connection && (
          <Pressable
            onPress={() => router.push('/email-settings')}
            style={({ pressed }) => [
              styles.editRow,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconLabel
              icon="mail-outline"
              iconSize={17}
              color={colors.teal}
              label="Connect an inbox"
              fontSize={14}
              fontWeight="600"
            />
          </Pressable>
        )}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Auto-reply delay</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.reminderHeaderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>
            Send the script after a lead comes in
          </Text>
          <Pill label={formatDelay(DELAY_STOPS[sliderIndex])} color={colors.teal} background={colors.tealSoft} />
        </View>

        <View style={[styles.sliderTrackWrap, { backgroundColor: colors.cardAlt }]}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={DELAY_STOPS.length - 1}
            step={1}
            value={committedIndex}
            onValueChange={(index) => setSliderIndex(Math.round(index))}
            onSlidingComplete={(index) => applyDelay(DELAY_STOPS[Math.round(index)])}
            minimumTrackTintColor={colors.teal}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.teal}
          />
          <View style={styles.tickRow} pointerEvents="none">
            {DELAY_STOPS.map((stop, i) => (
              <View
                key={stop}
                style={[
                  styles.tick,
                  { backgroundColor: i <= sliderIndex ? colors.teal : colors.border },
                  i === sliderIndex && styles.tickActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.sliderScale}>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>Instant</Text>
          <Text style={[styles.scaleLabel, { color: colors.faint }]}>1 hr</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.quickPickLabel, { color: colors.faint }]}>Quick pick</Text>
        <View style={styles.quickPickRow}>
          {DELAY_QUICK_PICKS.map((mins) => {
            const active = settings.autoReplyDelayMinutes === mins;
            return (
              <Pressable
                key={mins}
                onPress={() => applyDelay(mins)}
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
                  {formatDelay(mins)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.faint }]}>
          Only applies while Auto reply is on. "Instant" sends the moment a new lead arrives.
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Reply script</Text>
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
            label="Edit lead reply script"
            fontSize={14}
            fontWeight="600"
          />
        </Pressable>
        <Text style={[styles.hint, { color: colors.faint }]}>
          Placeholders: [name] [listing] [agent] [brokerage]. This is what gets sent when Auto
          replies is on, or pre-filled when you tap Reply.
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Lead history</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.reminderHeaderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>Keep sent leads for</Text>
          <Pill
            label={`${historyDays} day${historyDays === 1 ? '' : 's'}`}
            color={colors.teal}
            background={colors.tealSoft}
          />
        </View>

        <View style={[styles.sliderTrackWrap, { backgroundColor: colors.cardAlt }]}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={7}
            step={1}
            value={settings.leadHistoryRetentionDays}
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
          onPress={() => router.push('/leads-history')}
          style={({ pressed }) => [
            styles.editRow,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconLabel
            icon="time-outline"
            iconSize={17}
            color={colors.teal}
            label="View lead history"
            fontSize={14}
            fontWeight="600"
          />
        </Pressable>
        <Text style={[styles.hint, { color: colors.faint }]}>
          Every lead you've sent a script or custom reply to shows up here, with the full
          thread and timestamps. Raising the day count doesn't lose anything you already had.
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Who it sends from</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        <View style={styles.senderRow}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.teal} />
          <Text style={[styles.senderText, { color: colors.text }]}>
            A reply always sends from whichever inbox actually received that lead — never from
            whoever taps Send. So if a lead lands in your inbox and someone with shared access
            sends the reply, the client still sees it come from you. The same is true in
            reverse for leads that land in their inbox instead.
          </Text>
        </View>
      </View>

      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit lead reply script</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholder={DEFAULT_LEAD_SCRIPT}
              placeholderTextColor={colors.faint}
            />
            <Text style={[styles.hint, { color: colors.faint }]}>
              Placeholders: [name] [listing] [agent] [brokerage]
            </Text>
            <View style={styles.modalActions}>
              <GhostButton
                label="Cancel"
                onPress={() => setEditorOpen(false)}
                style={styles.modalButton}
              />
              <PrimaryButton label="Save" onPress={save} style={styles.modalButton} />
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
  firstSectionHeader: { marginTop: 0 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusTextCol: { flex: 1 },
  statusHeadline: { fontSize: 15, fontWeight: '700' },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reminderLabel: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
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
  senderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  senderText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
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
    minHeight: 140,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalButton: { flex: 1 },
});
