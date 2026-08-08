import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { clearLeadHistory, getLead, getLeadReplies, getLeadSentMessages, recordLeadSentMessage } from '../../api';
import { useSession } from '../../auth/session';
import { GhostButton, PrimaryButton } from '../../components/buttons';
import { useContactSheet } from '../../components/contactSheet';
import { useToast } from '../../components/toast';
import { cardShadow, HEADER_ICON_SIZE, headerIconButton, radius, useTheme } from '../../theme';
import { Lead, LeadReply, LeadSentMessage } from '../../types';
import { Identity, getEmailIdentities, resolveLeadIdentity } from '../../identities';
import { formatPhoneDisplay } from '../../validation';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type ThreadItem =
  | { kind: 'inbound'; body: string; whenLabel: string }
  | { kind: 'sent'; body: string; at: string; identityId: string }
  | { kind: 'reply'; body: string; at: string };

export default function LeadHistoryThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const toast = useToast();
  const { promptPhone, promptEmail } = useContactSheet();
  const { user } = useSession();
  const [lead, setLead] = useState<Lead | null | undefined>(null);
  const [messages, setMessages] = useState<LeadSentMessage[]>([]);
  const [clientReply, setClientReply] = useState<LeadReply | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getLead(id).then((l) => setLead(l ?? undefined));
    getLeadSentMessages(id).then(setMessages);
    getLeadReplies().then((replies) => setClientReply(replies[id] ?? null));
    getEmailIdentities(user).then(setIdentities);
  }, [id, user]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setMenuOpen((o) => !o)}
          hitSlop={8}
          style={({ pressed }) => [
            headerIconButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1, marginRight: 16 },
          ]}
        >
          <Ionicons name="ellipsis-horizontal" size={HEADER_ICON_SIZE} color={colors.teal} />
        </Pressable>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [navigation, colors]);

  const openEmailCompose = () => {
    setMenuOpen(false);
    setEmailDraft('');
    setEmailComposeOpen(true);
  };

  const sendEmail = async () => {
    if (!lead || !emailDraft.trim()) return;
    setSending(true);
    const identity = resolveLeadIdentity(identities, lead.receivedByEmail);
    await recordLeadSentMessage(lead.id, emailDraft.trim(), identity.id);
    const fresh = await getLeadSentMessages(lead.id);
    setMessages(fresh);
    setSending(false);
    setEmailComposeOpen(false);
    toast(`Email sent to ${lead.name}`);
  };

  const openInMail = () => {
    setMenuOpen(false);
    if (!lead) return;
    const subject = encodeURIComponent(`Re: ${lead.listing}`);
    Linking.openURL(`mailto:${lead.email}?subject=${subject}`).catch(() =>
      toast('No mail app configured on this device', 'error')
    );
  };

  const confirmDelete = async () => {
    if (!lead) return;
    setDeleting(true);
    await clearLeadHistory(lead.id);
    setDeleting(false);
    setDeleteConfirmOpen(false);
    toast(`${lead.name} removed from Lead history`);
    // Same reasoning as lead/[id].tsx's delete flow — the toast provider
    // clears itself the instant the route changes, so navigating back in
    // the same tick would never give it a chance to render.
    await new Promise((resolve) => setTimeout(resolve, 700));
    router.back();
  };

  if (lead === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  if (lead === undefined) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: colors.subtext }}>Lead not found.</Text>
      </View>
    );
  }

  const thread: ThreadItem[] = [
    { kind: 'inbound', body: lead.emailBody, whenLabel: lead.receivedAt } as ThreadItem,
    ...messages.map((m): ThreadItem => ({ kind: 'sent', body: m.body, at: m.sentAt, identityId: m.identityId })),
    ...(clientReply ? [{ kind: 'reply', body: clientReply.body, at: clientReply.receivedAt } as ThreadItem] : []),
  ].sort((a, b) => {
    if (a.kind === 'inbound') return -1;
    if (b.kind === 'inbound') return 1;
    return a.at < b.at ? -1 : 1;
  });

  return (
    <>
      <Stack.Screen options={{ title: lead.name }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          <Text style={[styles.name, { color: colors.text }]}>{lead.name}</Text>
          <Text style={[styles.meta, { color: colors.subtext }]}>
            <Ionicons name="location-outline" size={13} color={colors.subtext} /> {lead.listing}
          </Text>
          <Text
            style={[styles.meta, { color: colors.teal }]}
            onPress={() => promptPhone(lead.phone, lead.name)}
          >
            <Ionicons name="call-outline" size={13} color={colors.teal} />{' '}
            {formatPhoneDisplay(lead.phone)}
          </Text>
          <Text
            style={[styles.meta, { color: colors.teal }]}
            onPress={() => promptEmail(lead.email, lead.name)}
          >
            <Ionicons name="mail-outline" size={13} color={colors.teal} /> {lead.email}
          </Text>
          <Text style={[styles.received, { color: colors.faint }]}>
            Inquired {lead.receivedAt} via {lead.source}
          </Text>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Thread</Text>
        {thread.map((item, i) => {
          if (item.kind === 'sent') {
            const identity = identities.find((idn) => idn.id === item.identityId);
            return (
              <View key={i} style={styles.sentRow}>
                <View style={[styles.bubble, styles.sentBubble, { backgroundColor: colors.teal }]}>
                  {identity && identities.length > 1 && (
                    <Text style={[styles.senderLabel, { color: colors.onTeal }]}>
                      <Ionicons name="mail-outline" size={11} color={colors.onTeal} /> Sent by{' '}
                      {identity.label}
                    </Text>
                  )}
                  <Text style={[styles.threadBody, { color: colors.onTeal }]}>{item.body}</Text>
                </View>
                <Text style={[styles.threadTime, styles.sentTime, { color: colors.faint }]}>
                  {formatWhen(item.at)}
                </Text>
              </View>
            );
          }
          const label =
            item.kind === 'inbound'
              ? `${lead.name.split(' ')[0]}'s inquiry · ${item.whenLabel}`
              : `${lead.name.split(' ')[0]} replied`;
          return (
            <View key={i} style={styles.receivedRow}>
              <Text style={[styles.bubbleLabel, { color: colors.subtext }]}>{label}</Text>
              <View style={[styles.bubble, styles.receivedBubble, { backgroundColor: colors.neutral }]}>
                <Text style={[styles.threadBody, { color: colors.text }]}>{item.body}</Text>
              </View>
              {item.kind === 'reply' && (
                <Text style={[styles.threadTime, { color: colors.faint }]}>
                  {formatWhen(item.at)}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {menuOpen && (
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, cardShadow, { backgroundColor: colors.card }]}>
            <Pressable
              onPress={openEmailCompose}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="create-outline" size={17} color={colors.text} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>Email</Text>
            </Pressable>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={openInMail}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="mail-open-outline" size={17} color={colors.text} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>Open in Mail</Text>
            </Pressable>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setDeleteConfirmOpen(true);
              }}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
              <Text style={[styles.menuLabel, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      <Modal
        visible={emailComposeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailComposeOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Email {lead.name}</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={emailDraft}
              onChangeText={setEmailDraft}
              multiline
              autoFocus
              placeholder="Write your message…"
              placeholderTextColor={colors.faint}
            />
            <PrimaryButton
              label={sending ? 'Sending…' : 'Send'}
              onPress={sendEmail}
              style={{ marginTop: 14 }}
            />

            {/* Rendered last so it paints above the title's full-width Text
                box — an earlier sibling here gets covered by that box's
                empty-but-still-hit-testable area and never receives taps. */}
            <Pressable
              onPress={() => setEmailComposeOpen(false)}
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

      <Modal
        visible={deleteConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteConfirmOpen(false)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Remove from Lead history?</Text>
            <Text style={[styles.modalBody, { color: colors.subtext }]}>
              {lead.name}'s sent-message thread will be cleared from Lead history. The lead itself
              isn't affected — it stays in Leads and Contacts.
            </Text>
            <View style={styles.modalActions}>
              <GhostButton
                label="Cancel"
                onPress={() => setDeleteConfirmOpen(false)}
                style={styles.modalButton}
              />
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.modalDangerButton,
                  { backgroundColor: colors.danger, opacity: pressed || deleting ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalDangerLabel}>{deleting ? 'Removing…' : 'Delete'}</Text>
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
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, padding: 16 },
  name: { fontSize: 19, fontWeight: '700', marginBottom: 8 },
  meta: { fontSize: 13, marginTop: 5 },
  received: { fontSize: 11, marginTop: 10 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  threadBody: { fontSize: 14, lineHeight: 21 },
  bubble: { maxWidth: '80%', borderRadius: radius.card, padding: 12 },
  sentRow: { alignItems: 'flex-end', marginBottom: 12 },
  receivedRow: { alignItems: 'flex-start', marginBottom: 12 },
  sentBubble: { borderBottomRightRadius: 6 },
  receivedBubble: { borderBottomLeftRadius: 6 },
  bubbleLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 4, marginLeft: 4 },
  senderLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  threadTime: { fontSize: 11, marginTop: 5 },
  sentTime: { textAlign: 'right' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    position: 'absolute',
    top: 8,
    right: 16,
    minWidth: 190,
    borderRadius: radius.button,
    paddingVertical: 6,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  menuLabel: { fontSize: 14.5, fontWeight: '600' },
  menuDivider: { height: 1, marginHorizontal: 12 },
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
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 12, paddingRight: 32 },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
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
