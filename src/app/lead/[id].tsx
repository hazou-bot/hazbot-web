import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteLead,
  getLead,
  getLeadReplies,
  getLeadReplyScript,
  getSettings,
  markLeadViewed,
  recordLeadSentMessage,
} from '../../api';
import { useSession } from '../../auth/session';
import { GhostButton, PrimaryButton } from '../../components/buttons';
import { useContactSheet } from '../../components/contactSheet';
import { Pill } from '../../components/pill';
import { useToast } from '../../components/toast';
import { Identity, getEmailIdentities, resolveLeadIdentity } from '../../identities';
import { sendReplySentNotification } from '../../notifications';
import { cardShadow, HEADER_ICON_SIZE, radius, useTheme } from '../../theme';
import { Lead, LeadReply } from '../../types';

function formatReplyTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { promptEmail } = useContactSheet();
  const { user } = useSession();
  const [lead, setLead] = useState<Lead | null | undefined>(null);
  const [reply, setReply] = useState<LeadReply | null>(null);
  const [emailIdentities, setEmailIdentities] = useState<Identity[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState('');
  const [composeEditable, setComposeEditable] = useState(true);
  const [composeIdentity, setComposeIdentity] = useState<Identity | null>(null);
  const [sending, setSending] = useState(false);
  // Alert.alert wasn't reliably showing/responding on device for this
  // destructive confirmation, so it uses the app's own Modal instead.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getLead(id).then((l) => setLead(l ?? undefined));
    getLeadReplies().then((replies) => setReply(replies[id] ?? null));
    getEmailIdentities(user).then(setEmailIdentities);
    markLeadViewed(id);
  }, [id, user]);

  // Always the identity whose inbox actually received this lead — never a
  // manually-picked default, so the client never sees a reply from a
  // different address than the one they originally emailed.
  const leadIdentity = lead ? resolveLeadIdentity(emailIdentities, lead.receivedByEmail) : null;

  const openInMail = () => {
    if (!lead) return;
    // TODO: real version deep-links to this exact thread (message-id lookup
    // against the connected inbox) instead of opening a blank compose.
    // mailto: can't force which of the device's Mail accounts sends it, so
    // just remind Harry which one this lead needs if he has more than one.
    if (leadIdentity && emailIdentities.length > 1) {
      toast(`Reply from ${leadIdentity.sublabel} in Mail`);
    }
    const subject = encodeURIComponent(`Re: ${lead.listing}`);
    Linking.openURL(`mailto:${lead.email}?subject=${subject}`).catch(() =>
      toast('No mail app configured on this device', 'error')
    );
  };

  const openScript = async () => {
    if (!lead) return;
    const script = await getLeadReplyScript();
    const identity = resolveLeadIdentity(emailIdentities, lead.receivedByEmail);
    const agentName = identity.label ?? user?.name ?? 'Agent';
    const filled = script
      .replaceAll('[name]', lead.name.split(' ')[0])
      .replaceAll('[listing]', lead.listing)
      .replaceAll('[agent]', agentName.split(' ')[0])
      .replaceAll('[brokerage]', user?.brokerage ?? 'Brooklyn Group');
    setComposeDraft(filled);
    setComposeEditable(false);
    setComposeIdentity(identity);
    setComposeOpen(true);
  };

  const openCustom = () => {
    if (!lead) return;
    setComposeDraft('');
    setComposeEditable(true);
    setComposeIdentity(resolveLeadIdentity(emailIdentities, lead.receivedByEmail));
    setComposeOpen(true);
  };

  const closeCompose = () => setComposeOpen(false);

  const sendCompose = async () => {
    if (!lead) return;
    setSending(true);
    await recordLeadSentMessage(lead.id, composeDraft, composeIdentity?.id ?? 'me');
    setSending(false);
    setComposeOpen(false);
    toast(`Email reply sent to ${lead.name}`);
    const settings = await getSettings();
    await sendReplySentNotification(lead.name, settings);
  };

  const confirmDelete = async () => {
    if (!lead) return;
    setDeleting(true);
    await deleteLead(lead.id);
    setDeleting(false);
    setDeleteModalOpen(false);
    toast(`${lead.name} deleted`);
    // The toast provider clears itself the instant the route changes, so
    // navigating back in the same tick as toast() never gave it a chance to
    // render — confirmed real bug (deleting a lead showed no confirmation
    // at all). A brief pause lets it actually show before we leave.
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

  return (
    <>
      <Stack.Screen options={{ title: lead.name }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.leadBanner, cardShadow, { backgroundColor: colors.teal }]}>
          <Text style={[styles.leadBannerName, { color: colors.onTeal }]}>{lead.name}</Text>
          <View style={styles.leadBannerPillWrap}>
            <Pill
              label={lead.source}
              color={lead.source === 'StreetEasy' ? colors.teal : colors.amber}
              background={colors.card}
            />
          </View>

          <View style={styles.leadBannerMetaList}>
            <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal }]}>
              <Ionicons name="location-outline" size={14} color={colors.onTeal} /> {lead.listing}
            </Text>
            <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal }]}>
              <Ionicons name="mail-outline" size={14} color={colors.onTeal} /> {lead.email}
            </Text>
            <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal }]}>
              <Ionicons name="cash-outline" size={14} color={colors.onTeal} /> Income {lead.income}
              {lead.credit && ` · Credit ${lead.credit}`}
            </Text>
            <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal }]}>
              <Ionicons name="time-outline" size={14} color={colors.onTeal} /> {lead.availability}
            </Text>
            <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal, opacity: 0.85 }]}>
              Received {lead.receivedAt} via {lead.source}
            </Text>
            {leadIdentity && emailIdentities.length > 1 && (
              <Text style={[styles.leadBannerMetaRow, { color: colors.onTeal, opacity: 0.85 }]}>
                <Ionicons name="mail-outline" size={12} color={colors.onTeal} /> {leadIdentity.sublabel}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Original email</Text>
        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          <Text style={[styles.emailBody, { color: colors.text }]}>{lead.emailBody}</Text>
        </View>

        {reply && (
          <>
            <Text style={[styles.sectionHeader, { color: colors.subtext }]}>
              {lead.name.split(' ')[0]}'s reply
            </Text>
            <View style={styles.replyRow}>
              <View style={[styles.replyBubble, { backgroundColor: colors.tealSoft }]}>
                <Text style={[styles.replyBody, { color: colors.text }]}>{reply.body}</Text>
              </View>
            </View>
            <Text style={[styles.replyTime, { color: colors.faint }]}>
              {formatReplyTime(reply.receivedAt)}
            </Text>
          </>
        )}

        <View style={[styles.card, cardShadow, { backgroundColor: colors.card, marginTop: 20, padding: 8 }]}>
          <Pressable
            onPress={() => promptEmail(lead.email, lead.name)}
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
              <Ionicons name="mail" size={HEADER_ICON_SIZE} color={colors.teal} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.teal }]}>
              Email {lead.name.split(' ')[0]}
            </Text>
          </Pressable>

          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={openCustom}
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: `${colors.yellow}26` }]}>
              <Ionicons name="create" size={HEADER_ICON_SIZE} color={colors.yellow} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Write custom reply</Text>
          </Pressable>

          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={openScript}
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
              <Ionicons name="document-text" size={HEADER_ICON_SIZE} color={colors.teal} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.teal }]}>Use reply script</Text>
          </Pressable>

          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={openInMail}
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
              <Ionicons name="open-outline" size={HEADER_ICON_SIZE} color={colors.text} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>
              Open in {Platform.OS === 'ios' ? 'Mail' : 'email'}
            </Text>
          </Pressable>

          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => setDeleteModalOpen(true)}
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete lead</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={composeOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCompose}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
            {lead && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Reply to {lead.name}
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
                      backgroundColor: composeEditable ? colors.inputBg : colors.cardAlt,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={composeDraft}
                  onChangeText={setComposeDraft}
                  editable={composeEditable}
                  multiline
                  placeholder="Write your message…"
                  placeholderTextColor={colors.faint}
                />
                <PrimaryButton
                  label={sending ? 'Sending…' : 'Send'}
                  onPress={sendCompose}
                  style={{ marginTop: 14 }}
                />
                <GhostButton
                  label="Cancel"
                  onPress={closeCompose}
                  style={{ marginTop: 10 }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteModalOpen(false)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            {lead && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Delete this lead?</Text>
                <Text style={[styles.modalBody, { color: colors.subtext }]}>
                  {lead.name}'s lead and email will be permanently removed from AgentEasy.
                </Text>
                <View style={styles.modalActions}>
                  <GhostButton
                    label="Cancel"
                    onPress={() => setDeleteModalOpen(false)}
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
                    <Text style={styles.modalDangerLabel}>
                      {deleting ? 'Deleting…' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
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
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, padding: 16 },
  // Lead detail banner + action list — same shape as the Contacts/Units/
  // Showings detail cards (colored banner header, then a flat action-row
  // list) so this page reads as the same idiom as the rest of the app.
  leadBanner: { alignItems: 'center', borderRadius: radius.card, padding: 20 },
  leadBannerName: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  leadBannerPillWrap: { alignSelf: 'center', marginTop: 8 },
  leadBannerMetaList: { alignSelf: 'stretch', marginTop: 18, gap: 8 },
  leadBannerMetaRow: { fontSize: 13.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 8 },
  actionIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionDivider: { height: 1, marginLeft: 42 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  emailBody: { fontSize: 14, lineHeight: 21 },
  replyRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  replyBubble: {
    maxWidth: '85%',
    borderRadius: radius.card,
    borderBottomRightRadius: 6,
    padding: 14,
  },
  replyBody: { fontSize: 14, lineHeight: 21 },
  replyTime: { fontSize: 11, marginTop: 6, textAlign: 'right' },
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
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 12 },
  sendingAsLabel: { fontSize: 12.5, marginTop: -8, marginBottom: 12 },
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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButton: { flex: 1 },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalDangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
});
