import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getEmailConnection,
  getLeadReplies,
  getLeadReplyScript,
  getLeadReplyState,
  getLeads,
  getSettings,
  getSkippedLeads,
  getUnseenLeadCount,
  recordLeadSentMessage,
  recordLeadSentMessages,
  scanInbox,
  skipLead,
  updateSettings,
} from '../../api';
import { useSession } from '../../auth/session';
import { useSetBadgeCount } from '../../badges';
import { GhostButton, PrimaryButton } from '../../components/buttons';
import { computeLiveStatus, liveStatusLabel, LiveStatusDot } from '../../components/liveStatusDot';
import { Pill } from '../../components/pill';
import { PressableCard } from '../../components/pressableCard';
import { useToast } from '../../components/toast';
import { Identity, getEmailIdentities, resolveLeadIdentity } from '../../identities';
import {
  sendLeadReplyNotification,
  sendReplyAllSentNotification,
  sendReplySentNotification,
} from '../../notifications';
import { cardShadow, HEADER_ICON_SIZE, headerIconButton, headerRightRow, radius, useTheme } from '../../theme';
import { EmailConnection, Lead, LeadReply, LeadSource } from '../../types';

/** How long a reply shows as "Reply sent" before flipping to "Waiting for response". */
const WAITING_THRESHOLD_MS = 20_000;

const SOURCE_FILTERS: LeadSource[] = ['StreetEasy', 'Zillow'];

export default function LeadsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useSession();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [autoReply, setAutoReply] = useState(false);
  const [autoReplyEnabledAt, setAutoReplyEnabledAt] = useState<string | null>(null);
  const [autoReplyDelayMinutes, setAutoReplyDelayMinutes] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [replyState, setReplyState] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, LeadReply>>({});
  const [sourceFilter, setSourceFilter] = useState<LeadSource | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composeLead, setComposeLead] = useState<Lead | null>(null);
  const [composeDraft, setComposeDraft] = useState('');
  const [composeEditing, setComposeEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailIdentities, setEmailIdentities] = useState<Identity[]>([]);
  const [composeIdentity, setComposeIdentity] = useState<Identity | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [emailConnection, setEmailConnection] = useState<EmailConnection | null>(null);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const setBadgeCount = useSetBadgeCount('leads');

  const loadAll = useCallback(() => {
    getLeads().then(setLeads);
    getSkippedLeads().then((l) => setSkippedCount(l.length));
    getSettings().then((s) => {
      setAutoReply(s.autoReplyLeads);
      setAutoReplyEnabledAt(s.autoReplyEnabledAt);
      setAutoReplyDelayMinutes(s.autoReplyDelayMinutes);
    });
    getLeadReplyState().then(setReplyState);
    getLeadReplies().then(setReplies);
    getEmailIdentities(user).then(setEmailIdentities);
    getUnseenLeadCount().then(setBadgeCount);
    getEmailConnection().then(setEmailConnection);
  }, [user, setBadgeCount]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const reply = async (lead: Lead, body: string, identityId: string) => {
    await recordLeadSentMessage(lead.id, body, identityId);
    setReplyState((prev) => ({ ...prev, [lead.id]: new Date().toISOString() }));
    toast(`Email reply sent to ${lead.name}`);
    const settings = await getSettings();
    await sendReplySentNotification(lead.name, settings);
  };

  // Every lead that hasn't had a script sent yet and hasn't already replied
  // in — a client reply gets a tailored response via Reply/Edit, not the
  // blind bulk script, so those are left out. Includes leads still mid
  // auto-reply countdown: Reply All means "send everything outstanding
  // right now," not "wait for the timer."
  const sendAllReplies = async () => {
    if (!leads || sendingAll) return;
    const targets = leads.filter((l) => !replyState[l.id] && !replies[l.id]);
    if (targets.length === 0) {
      toast('No leads need a reply right now');
      return;
    }
    setSendingAll(true);
    const script = await getLeadReplyScript();
    const entries = targets.map((lead) => {
      const identity = resolveLeadIdentity(emailIdentities, lead.receivedByEmail);
      const agentName = identity.label ?? user?.name ?? 'Agent';
      const body = script
        .replaceAll('[name]', lead.name.split(' ')[0])
        .replaceAll('[listing]', lead.listing)
        .replaceAll('[agent]', agentName.split(' ')[0])
        .replaceAll('[brokerage]', user?.brokerage ?? 'Brooklyn Group');
      return { id: lead.id, body, identityId: identity.id };
    });
    await recordLeadSentMessages(entries);
    loadAll();
    toast(`Replied to ${entries.length} lead${entries.length === 1 ? '' : 's'}`);
    const settings = await getSettings();
    await sendReplyAllSentNotification(entries.length, settings);
    setSendingAll(false);
  };

  const openCompose = async (lead: Lead, startEditing = false) => {
    const script = await getLeadReplyScript();
    // Always the identity whose inbox actually received this lead — never a
    // manually-picked default, so the client never sees a reply from a
    // different address than the one they originally emailed.
    const identity = resolveLeadIdentity(emailIdentities, lead.receivedByEmail);
    const agentName = identity.label ?? user?.name ?? 'Agent';
    const filled = script
      .replaceAll('[name]', lead.name.split(' ')[0])
      .replaceAll('[listing]', lead.listing)
      .replaceAll('[agent]', agentName.split(' ')[0])
      .replaceAll('[brokerage]', user?.brokerage ?? 'Brooklyn Group');
    setComposeDraft(filled);
    setComposeEditing(startEditing);
    setComposeIdentity(identity);
    setComposeLead(lead);
  };

  const closeCompose = () => setComposeLead(null);

  const sendCompose = async () => {
    if (!composeLead) return;
    setSending(true);
    await reply(composeLead, composeDraft, composeIdentity?.id ?? 'me');
    setSending(false);
    setComposeLead(null);
  };

  const refresh = async () => {
    setRefreshing(true);
    const result = await scanInbox();
    loadAll();
    setRefreshing(false);
    if (result.newReplies.length > 0) {
      const settings = await getSettings();
      await sendLeadReplyNotification(
        result.newReplies.map((r) => r.name),
        settings
      );
      const [first] = result.newReplies;
      toast(
        result.newReplies.length === 1
          ? `${first.name} replied`
          : `${result.newReplies.length} leads replied`
      );
    } else {
      toast(`Checked your inbox — ${result.scannedEmails} emails scanned, ${result.leadsImported} leads up to date`);
    }
  };

  const toggleAutoReply = useCallback(
    async (value: boolean) => {
      setAutoReply(value);
      if (value) {
        const enabledAt = new Date().toISOString();
        setAutoReplyEnabledAt(enabledAt);
        await updateSettings({ autoReplyLeads: true, autoReplyEnabledAt: enabledAt });
      } else {
        await updateSettings({ autoReplyLeads: false });
      }
      toast(value ? 'Auto replies ON — new leads get your script automatically' : 'Auto replies off');
    },
    [toast]
  );

  const liveStatus = computeLiveStatus(!!emailConnection, emailConnection?.lastScanAt ?? null, refreshing);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.push('/leads-history')}
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
            onPress={() => router.push('/skipped-leads')}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="eye-off-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
            {skippedCount > 0 && (
              <View style={[styles.headerBadge, { backgroundColor: colors.danger, borderColor: colors.bg }]}>
                <Text style={styles.headerBadgeLabel}>{skippedCount > 9 ? '9+' : skippedCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/leads-settings')}
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
  }, [navigation, colors, router, skippedCount, liveStatus]);

  const visible = useMemo(() => {
    if (!leads) return [];
    // Mock data is authored newest-first; "oldest" just reverses that order.
    const ordered = sort === 'newest' ? leads : [...leads].reverse();
    const bySource = sourceFilter ? ordered.filter((l) => l.source === sourceFilter) : ordered;
    const q = query.trim().toLowerCase();
    if (!q) return bySource;
    return bySource.filter((l) =>
      [
        l.name,
        l.listing,
        l.source,
        l.summary,
        l.income,
        l.credit,
        l.availability,
        l.email,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [leads, query, sort, sourceFilter]);

  if (!leads) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const skip = async (lead: Lead) => {
    await skipLead(lead.id);
    setLeads((prev) => (prev ? prev.filter((l) => l.id !== lead.id) : prev));
    setSkippedCount((c) => c + 1);
    toast(`Skipped ${lead.name}`);
  };

  return (
    <>
    <FlatList
      data={visible}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal} />
      }
      ListHeaderComponent={
        <>
          <View style={[styles.autoReplyCard, cardShadow, { backgroundColor: colors.card }]}>
            <View style={styles.autoReplyTopRow}>
              <Pressable
                onPress={() => setBulkOpen((o) => !o)}
                style={{ flex: 1 }}
                hitSlop={4}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.autoReplyLabel, { color: colors.text }]}>
                    Auto-reply to new leads
                  </Text>
                  <Ionicons
                    name={bulkOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.subtext}
                  />
                </View>
                <Text style={[styles.autoReplyHint, { color: colors.faint }]}>
                  Send your reply script automatically
                </Text>
              </Pressable>
              <Switch
                value={autoReply}
                onValueChange={toggleAutoReply}
                trackColor={{ true: colors.teal, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>

            {bulkOpen && (
              <View style={[styles.bulkReplyRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.autoReplyLabel, { color: colors.text, fontSize: 14 }]}>
                    Reply All
                  </Text>
                  <Text style={[styles.autoReplyHint, { color: colors.faint }]}>
                    Send your reply script to every lead that hasn't been replied to yet
                  </Text>
                </View>
                <PrimaryButton
                  label={sendingAll ? 'Sending…' : 'Send'}
                  onPress={sendAllReplies}
                  style={styles.bulkReplyButton}
                />
              </View>
            )}
          </View>

          <View
            style={[
              styles.searchBar,
              cardShadow,
              { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search-outline" size={17} color={colors.faint} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, address, income, source…"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={colors.faint} />
              </Pressable>
            )}
          </View>
          <View style={styles.sourceChips}>
            <Pressable
              onPress={() => setSourceFilter(null)}
              style={({ pressed }) => [
                styles.sourceChip,
                {
                  backgroundColor: sourceFilter === null ? colors.text : colors.cardAlt,
                  borderColor: sourceFilter === null ? colors.text : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.sourceChipLabel,
                  { color: sourceFilter === null ? colors.bg : colors.subtext },
                ]}
              >
                All
              </Text>
            </Pressable>
            {SOURCE_FILTERS.map((source) => {
              const active = sourceFilter === source;
              const tint = source === 'StreetEasy' ? colors.teal : colors.amber;
              const soft = source === 'StreetEasy' ? colors.tealSoft : colors.amberSoft;
              return (
                <Pressable
                  key={source}
                  onPress={() => setSourceFilter((prev) => (prev === source ? null : source))}
                  style={({ pressed }) => [
                    styles.sourceChip,
                    {
                      backgroundColor: active ? tint : soft,
                      borderColor: active ? tint : soft,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.sourceChipLabel, { color: active ? colors.onTeal : tint }]}
                  >
                    {source}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.resultsRow}>
            <Text style={[styles.resultsCount, { color: colors.faint }]}>
              {visible.length} lead{visible.length === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              style={({ pressed }) => [styles.sortButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="swap-vertical-outline" size={15} color={colors.teal} />
              <Text style={[styles.sortLabel, { color: colors.teal }]}>
                {sort === 'newest' ? 'Newest first' : 'Oldest first'}
              </Text>
            </Pressable>
          </View>
        </>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.subtext }]}>
          {query
            ? `No leads match “${query}”.`
            : sourceFilter
              ? `No ${sourceFilter} leads right now.`
              : 'Inbox zero — no open leads. 🎉'}
        </Text>
      }
      renderItem={({ item: lead }) => {
        // A manual reply (real, permanent) always wins. Otherwise, while
        // Auto reply is on, every lead is scheduled to send autoReplyDelayMinutes
        // after the toggle flipped — purely visual (no real "lead received at"
        // timestamp to key off), so switching it back off immediately restores
        // the Reply button for anything that was never actually (manually)
        // replied to.
        const autoReplyScheduledAt =
          autoReply && autoReplyEnabledAt
            ? new Date(
                new Date(autoReplyEnabledAt).getTime() + autoReplyDelayMinutes * 60_000
              ).toISOString()
            : null;
        const autoReplyPending =
          autoReplyScheduledAt !== null && Date.now() < new Date(autoReplyScheduledAt).getTime();
        const sentAt = replyState[lead.id] ?? (autoReplyPending ? null : autoReplyScheduledAt);
        const clientReply = replies[lead.id];
        return (
        <PressableCard onPress={() => router.push(`/lead/${lead.id}`)} style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={[styles.name, { color: colors.text }]}>{lead.name}</Text>
            <View style={styles.pillGroup}>
              {clientReply ? (
                <Pill label="Replied" color={colors.teal} background={colors.tealSoft} />
              ) : (
                sentAt && <Pill label="Sent" color={colors.teal} background={colors.tealSoft} />
              )}
              <Pill
                label={lead.source}
                color={lead.source === 'StreetEasy' ? colors.teal : colors.amber}
                background={lead.source === 'StreetEasy' ? colors.tealSoft : colors.amberSoft}
              />
            </View>
          </View>

          <Text style={[styles.listing, { color: colors.subtext }]}>
            <Ionicons name="location-outline" size={13} color={colors.subtext} /> {lead.listing}
          </Text>

          <Text style={[styles.summary, { color: colors.text }]}>{lead.summary}</Text>

          <View style={styles.metaBlock}>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              <Ionicons name="cash-outline" size={13} color={colors.subtext} /> Income {lead.income}
              {lead.credit && ` · Credit ${lead.credit}`}
            </Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              <Ionicons name="time-outline" size={13} color={colors.subtext} />{' '}
              {lead.availability}
            </Text>
          </View>

          {(() => {
            if (clientReply) {
              return (
                <>
                  <View style={styles.replyStatusRow}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.teal} />
                    <Text style={[styles.replyStatusLabel, { color: colors.teal }]}>
                      {lead.name.split(' ')[0]} replied
                    </Text>
                  </View>
                  <View style={[styles.replyBubble, { backgroundColor: colors.tealSoft }]}>
                    <Text
                      style={[styles.replyBubbleText, { color: colors.text }]}
                      numberOfLines={3}
                    >
                      {clientReply.body}
                    </Text>
                  </View>
                  <View style={styles.replyActions}>
                    <PrimaryButton
                      label="Send"
                      style={styles.replyActionButton}
                      onPress={() => openCompose(lead)}
                    />
                    <GhostButton
                      label="Edit"
                      style={styles.replyActionButton}
                      onPress={() => openCompose(lead, true)}
                    />
                    <PrimaryButton
                      label="Skip"
                      background={colors.yellow}
                      textColor="#241505"
                      style={styles.replyActionButton}
                      onPress={() => skip(lead)}
                    />
                  </View>
                </>
              );
            }
            if (sentAt) {
              const waiting = Date.now() - new Date(sentAt).getTime() > WAITING_THRESHOLD_MS;
              return (
                <>
                  <View style={styles.replyStatusRow}>
                    <Ionicons
                      name={waiting ? 'time-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={waiting ? colors.amber : colors.teal}
                    />
                    <Text
                      style={[
                        styles.replyStatusLabel,
                        { color: waiting ? colors.amber : colors.teal },
                      ]}
                    >
                      {waiting ? 'Waiting for response' : 'Reply sent'}
                    </Text>
                  </View>
                  <PrimaryButton
                    label="Skip"
                    background={colors.yellow}
                    textColor="#241505"
                    style={{ marginTop: 10 }}
                    onPress={() => skip(lead)}
                  />
                </>
              );
            }
            if (autoReplyPending && autoReplyScheduledAt) {
              const minsLeft = Math.max(
                1,
                Math.ceil((new Date(autoReplyScheduledAt).getTime() - Date.now()) / 60_000)
              );
              return (
                <>
                  <View style={styles.replyStatusRow}>
                    <Ionicons name="timer-outline" size={16} color={colors.amber} />
                    <Text style={[styles.replyStatusLabel, { color: colors.amber }]}>
                      Auto-reply in {minsLeft} min
                    </Text>
                  </View>
                  <PrimaryButton
                    label="Skip"
                    background={colors.yellow}
                    textColor="#241505"
                    style={{ marginTop: 10 }}
                    onPress={() => skip(lead)}
                  />
                </>
              );
            }
            return (
              <View style={styles.actions}>
                <PrimaryButton label="Reply" style={styles.actionButton} onPress={() => openCompose(lead)} />
                <PrimaryButton
                  label="Skip"
                  background={colors.yellow}
                  textColor="#241505"
                  style={styles.actionButton}
                  onPress={() => skip(lead)}
                />
              </View>
            );
          })()}

          <Text style={[styles.received, { color: colors.faint }]}>{lead.receivedAt}</Text>
        </PressableCard>
        );
      }}
    />

    <View style={styles.statusFab} pointerEvents="box-none">
      <Pressable
        onPress={() => setStatusExpanded((e) => !e)}
        style={({ pressed }) => [
          statusExpanded ? styles.statusFabExpanded : styles.statusFabCollapsed,
          cardShadow,
          { backgroundColor: colors.neutral, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <LiveStatusDot status={liveStatus} size={10} />
        {statusExpanded && (
          <Text
            style={[
              styles.statusFabLabel,
              {
                color:
                  liveStatus === 'live'
                    ? colors.teal
                    : liveStatus === 'loading'
                    ? colors.yellow
                    : colors.danger,
              },
            ]}
          >
            {liveStatusLabel(liveStatus)}
          </Text>
        )}
      </Pressable>
    </View>

    <Modal
      visible={composeLead !== null}
      transparent
      animationType="fade"
      onRequestClose={closeCompose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
          {composeLead && (
            <>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Reply to {composeLead.name}
              </Text>
              {composeIdentity && emailIdentities.length > 1 && (
                <Text style={[styles.sendingAsLabel, { color: colors.subtext }]}>
                  <Ionicons name="mail-outline" size={12} color={colors.subtext} /> Sending as{' '}
                  {composeIdentity.label} ({composeIdentity.sublabel})
                </Text>
              )}
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: composeEditing ? colors.inputBg : colors.cardAlt,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={composeDraft}
                onChangeText={setComposeDraft}
                multiline
                editable={composeEditing}
                autoFocus={composeEditing}
              />
              <GhostButton
                label={composeEditing ? 'Editing…' : 'Edit'}
                onPress={() => setComposeEditing(true)}
                style={{ marginTop: 14 }}
              />
              <PrimaryButton
                label={sending ? 'Sending…' : 'Send'}
                onPress={sendCompose}
                style={{ marginTop: 10 }}
              />
            </>
          )}

          {/* Rendered last so it paints above the title's full-width Text
              box — an earlier sibling here gets covered by that box's
              empty-but-still-hit-testable area and never receives taps,
              even though only the title's own words are visible there. */}
          <Pressable
            onPress={closeCompose}
            hitSlop={8}
            style={({ pressed }) => [
              styles.modalCloseButton,
              { backgroundColor: colors.cardAlt, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="close" size={16} color={colors.subtext} />
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  statusFab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 12,
  },
  statusFabCollapsed: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFabExpanded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  statusFabLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
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
  bulkReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  bulkReplyButton: { paddingHorizontal: 20, minHeight: 40, paddingVertical: 0 },
  headerBadge: {
    position: 'absolute',
    top: 1,
    right: 3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeLabel: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', lineHeight: 11 },
  // Extra bottom padding clears the floating live-status pill so the last
  // card in the list is never hidden behind it.
  list: { padding: 18, gap: 16, paddingBottom: 90 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 2,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  sourceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, zIndex: 1 },
  sourceChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sourceChipLabel: { fontSize: 13, fontWeight: '700' },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  resultsCount: { fontSize: 12, fontWeight: '600' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  card: { padding: 18 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  pillGroup: { flexDirection: 'row', gap: 6 },
  listing: { fontSize: 13, marginTop: 4 },
  summary: { fontSize: 14, marginTop: 10, lineHeight: 20 },
  metaBlock: { marginTop: 10, gap: 3 },
  meta: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: { flex: 1 },
  replyActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  replyActionButton: { flex: 1, minHeight: 44, paddingHorizontal: 0 },
  replyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  replyStatusLabel: { fontSize: 13.5, fontWeight: '700' },
  replyBubble: {
    borderRadius: radius.card,
    borderBottomLeftRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  replyBubbleText: { fontSize: 13.5, lineHeight: 19 },
  received: { fontSize: 11, marginTop: 10 },
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
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4, paddingRight: 32 },
  sendingAsLabel: { fontSize: 12.5, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 160,
    textAlignVertical: 'top',
  },
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
});
