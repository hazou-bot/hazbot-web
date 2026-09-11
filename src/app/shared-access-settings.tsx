import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
  addSharedAccess,
  connectPersonDrive,
  connectPersonEmail,
  disconnectPersonDrive,
  disconnectPersonEmail,
  getInviteCode,
  getSharedAccess,
  regenerateInviteCode,
  removeSharedAccess,
  updateSharedAccess,
} from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel, PrimaryButton } from '../components/buttons';
import { useToast } from '../components/toast';
import { getPlan } from '../plans';
import { composeSms } from '../sms';
import { cardShadow, radius, useTheme } from '../theme';
import {
  DriveConnection,
  EmailConnection,
  InviteCode,
  SharedAccessModules,
  SharedAccessPerson,
} from '../types';
import { capitalizeWords, formatPhoneInput, isValidEmail, isValidPhone } from '../validation';

// TODO: swap for the real App Store/TestFlight link once published.
const DOWNLOAD_LINK = 'https://hazbot.app/download';

const MODULE_ROWS: { key: keyof SharedAccessModules; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'leads', label: 'Leads', icon: 'mail-unread-outline' },
  { key: 'units', label: 'Units', icon: 'business-outline' },
  { key: 'showings', label: 'Showings', icon: 'calendar-outline' },
  { key: 'contacts', label: 'Contacts', icon: 'people-outline' },
];

const NO_MODULES: SharedAccessModules = { leads: false, units: false, showings: false, contacts: false };

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function moduleSummary(modules: SharedAccessModules): string {
  const on = MODULE_ROWS.filter((m) => modules[m.key]).map((m) => m.label);
  return on.length > 0 ? on.join(' · ') : 'No access granted';
}

export default function SharedAccessSettingsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const plan = getPlan(user?.plan);
  const [people, setPeople] = useState<SharedAccessPerson[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SharedAccessPerson | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [modules, setModules] = useState<SharedAccessModules>(NO_MODULES);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SharedAccessPerson | null>(null);
  const [emailConn, setEmailConn] = useState<EmailConnection | null>(null);
  const [driveConn, setDriveConn] = useState<DriveConnection | null>(null);
  const [connectingEmail, setConnectingEmail] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);

  const load = useCallback(() => {
    getSharedAccess().then(setPeople);
    if (user) getInviteCode(user.name).then(setInviteCode);
  }, [user]);

  useFocusEffect(load);

  const seatsUsed = 1 + (people?.length ?? 0);
  const atSeatCap = seatsUsed >= plan.maxSeats;

  const openAdd = () => {
    if (atSeatCap) {
      toast(`${plan.label} allows ${plan.maxSeats} total — upgrade to add another teammate`, 'warning');
      return;
    }
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setModules(NO_MODULES);
    setEmailConn(null);
    setDriveConn(null);
    setFormOpen(true);
  };

  const openEdit = (person: SharedAccessPerson) => {
    setEditing(person);
    setName(person.name);
    setEmail(person.email);
    setPhone(person.phone ?? '');
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setModules(person.modules);
    setEmailConn(person.emailConnection ?? null);
    setDriveConn(person.driveConnection ?? null);
    setFormOpen(true);
  };

  const toggleModule = (key: keyof SharedAccessModules) =>
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (editing) {
      setSaving(true);
      await updateSharedAccess(editing.id, modules);
      setSaving(false);
      setFormOpen(false);
      toast(`${editing.name}'s access updated`);
      load();
      return;
    }
    const nextNameError = name.trim() ? null : 'Enter a name.';
    const nextEmailError = !email.trim()
      ? 'Enter an email.'
      : !isValidEmail(email)
        ? 'That doesn’t look like a valid email — double-check it.'
        : null;
    const nextPhoneError =
      phone.trim() && !isValidPhone(phone) ? 'Enter a valid phone number, e.g. 800-123-4567.' : null;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    if (nextNameError || nextEmailError || nextPhoneError) return;

    setSaving(true);
    const person = await addSharedAccess({ name, email, phone, modules });
    setSaving(false);
    setFormOpen(false);
    toast(`${person.name} added`);
    load();
  };

  const connectTheirEmail = async () => {
    if (!editing) return;
    setConnectingEmail(true);
    const conn = await connectPersonEmail(editing.id, editing.email);
    setConnectingEmail(false);
    setEmailConn(conn);
    toast(`Connected ${conn.address}`);
    load();
  };

  const disconnectTheirEmail = async () => {
    if (!editing) return;
    await disconnectPersonEmail(editing.id);
    setEmailConn(null);
    toast(`${editing.name}'s Gmail disconnected`);
    load();
  };

  const connectTheirDrive = async () => {
    if (!editing) return;
    setConnectingDrive(true);
    const conn = await connectPersonDrive(editing.id, 'Brooklyn Group Workbook', editing.email);
    setConnectingDrive(false);
    setDriveConn(conn);
    toast(`Connected ${conn.fileName}`);
    load();
  };

  const disconnectTheirDrive = async () => {
    if (!editing) return;
    await disconnectPersonDrive(editing.id);
    setDriveConn(null);
    toast(`${editing.name}'s workbook disconnected`);
    load();
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await removeSharedAccess(removeTarget.id);
    toast(`${removeTarget.name} removed`);
    setRemoveTarget(null);
    load();
  };

  const inviteMessage = (code: string) =>
    `${user?.name ?? 'Your teammate'} invited you to join their team on AgentEasy, the real estate ` +
    `lead cockpit. Download the app: ${DOWNLOAD_LINK}\nThen enter invite code ${code} when you ` +
    `sign up or log in to join automatically.`;

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode.code);
    toast('Code copied');
  };

  const sendInviteText = async () => {
    if (!inviteCode) return;
    const outcome = await composeSms([], inviteMessage(inviteCode.code));
    if (outcome === 'copied') {
      toast('Invite copied — paste it into your texting app.');
    } else if (outcome === 'unavailable') {
      toast('Texting isn’t available in this browser — use Email instead.', 'error');
    }
  };

  const sendInviteEmail = () => {
    if (!inviteCode) return;
    const subject = encodeURIComponent('Join me on AgentEasy');
    const body = encodeURIComponent(inviteMessage(inviteCode.code));
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`).catch(() =>
      toast('No mail app configured on this device', 'error')
    );
  };

  const regenerateCode = async () => {
    if (!user) return;
    const fresh = await regenerateInviteCode(user.name);
    setInviteCode(fresh);
    setRegenerateConfirmOpen(false);
    toast('New code generated — the old one no longer works');
  };

  if (!people) {
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
          Give someone else access to view and edit your leads, units, showings, and contacts
          from their own device. For now this saves who has access and what they can reach —
          once real accounts are set up, their device will sync with yours automatically.
        </Text>

        <Text style={[styles.seatsCaption, { color: colors.subtext }]}>
          {seatsUsed} of {plan.maxSeats} seat{plan.maxSeats === 1 ? '' : 's'} used on {plan.label}
        </Text>

        {!atSeatCap && (
          <View style={[styles.inviteCard, cardShadow, { backgroundColor: colors.card }]}>
            <Text style={[styles.inviteTitle, { color: colors.text }]}>Invite by code</Text>
            <Text style={[styles.inviteBody, { color: colors.subtext }]}>
              Share this code — they enter it when they sign up or log in to join automatically.
            </Text>

            <Pressable
              onPress={copyCode}
              style={({ pressed }) => [
                styles.codeRow,
                { backgroundColor: colors.neutral, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.codeText, { color: colors.text }]}>
                {inviteCode?.code ?? '••••-••••'}
              </Text>
              <Ionicons name="copy-outline" size={18} color={colors.teal} />
            </Pressable>

            <View style={styles.inviteActionsRow}>
              <GhostButton label="Text" onPress={sendInviteText} style={styles.inviteActionButton} />
              <GhostButton label="Email" onPress={sendInviteEmail} style={styles.inviteActionButton} />
            </View>

            <Pressable onPress={() => setRegenerateConfirmOpen(true)} hitSlop={6} style={{ marginTop: 12 }}>
              <Text style={[styles.regenerateLink, { color: colors.subtext }]}>Generate a new code</Text>
            </Pressable>
          </View>
        )}

        {atSeatCap ? (
          <Pressable
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.neutral, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconLabel
              icon="lock-closed-outline"
              iconSize={18}
              color={colors.teal}
              label={
                plan.maxSeats === 1
                  ? 'Upgrade to add a teammate'
                  : `Upgrade for more than ${plan.maxSeats} seats`
              }
              fontSize={14}
              fontWeight="600"
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={openAdd}
            style={({ pressed }) => [
              styles.addButton,
              cardShadow,
              { backgroundColor: colors.teal, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <IconLabel
              icon="person-add-outline"
              iconSize={18}
              color={colors.onTeal}
              label="Add person manually"
              fontSize={14}
              fontWeight="600"
            />
          </Pressable>
        )}

        {people.length === 0 ? (
          <Text style={[styles.empty, { color: colors.faint }]}>
            Nobody else has access yet.
          </Text>
        ) : (
          people.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => openEdit(person)}
              style={({ pressed }) => [
                styles.card,
                cardShadow,
                { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Pressable
                onPress={() => setRemoveTarget(person)}
                hitSlop={8}
                style={({ pressed }) => [styles.cardClose, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close" size={18} color={colors.faint} />
              </Pressable>

              <View style={styles.personRow}>
                <View style={[styles.avatar, { backgroundColor: colors.tealSoft }]}>
                  <Text style={[styles.avatarInitials, { color: colors.teal }]}>
                    {initials(person.name) || '?'}
                  </Text>
                </View>
                <View style={styles.personText}>
                  <Text style={[styles.personName, { color: colors.text }]}>{person.name}</Text>
                  <Text style={[styles.personEmail, { color: colors.subtext }]}>
                    {person.email}
                  </Text>
                  <Text style={[styles.personModules, { color: colors.faint }]}>
                    {moduleSummary(person.modules)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={formOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFormOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setFormOpen(false)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editing ? 'Edit access' : 'Add person'}
            </Text>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {!editing && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                    nameError && { borderColor: colors.danger },
                  ]}
                  value={name}
                  onChangeText={(t) => {
                    setName(capitalizeWords(t));
                    if (nameError) setNameError(null);
                  }}
                  onBlur={() => {
                    if (!name.trim()) setNameError('Enter a name.');
                  }}
                  placeholder="e.g. Daniel Cohen"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="words"
                />
                {nameError && <Text style={[styles.fieldError, { color: colors.danger }]}>{nameError}</Text>}

                <Text style={[styles.fieldLabel, { color: colors.subtext, marginTop: 12 }]}>
                  Email
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                    emailError && { borderColor: colors.danger },
                  ]}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (emailError) setEmailError(null);
                  }}
                  onBlur={() => {
                    if (!email.trim()) setEmailError('Enter an email.');
                    else if (!isValidEmail(email)) {
                      setEmailError('That doesn’t look like a valid email — double-check it.');
                    }
                  }}
                  placeholder="e.g. daniel@brooklyngroup.com"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {emailError && <Text style={[styles.fieldError, { color: colors.danger }]}>{emailError}</Text>}

                <Text style={[styles.fieldLabel, { color: colors.subtext, marginTop: 12 }]}>
                  Phone (optional — needed to pick their number for reminders)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                    phoneError && { borderColor: colors.danger },
                  ]}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(formatPhoneInput(t));
                    if (phoneError) setPhoneError(null);
                  }}
                  onBlur={() => {
                    if (phone.trim() && !isValidPhone(phone)) {
                      setPhoneError('Enter a valid phone number, e.g. 800-123-4567.');
                    }
                  }}
                  placeholder="800-123-4567"
                  placeholderTextColor={colors.faint}
                  keyboardType="phone-pad"
                  maxLength={14}
                />
                {phoneError && <Text style={[styles.fieldError, { color: colors.danger }]}>{phoneError}</Text>}
              </>
            )}

            {editing && (
              <View style={{ marginTop: 4 }}>
                <Text style={[styles.personName, { color: colors.text }]}>{editing.name}</Text>
                <Text style={[styles.personEmail, { color: colors.subtext }]}>
                  {editing.email}
                  {editing.phone ? ` · ${editing.phone}` : ''}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.subtext, marginTop: 16 }]}>
              Access
            </Text>
            <View
              style={[styles.moduleList, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            >
              {MODULE_ROWS.map((m, i) => (
                <View key={m.key}>
                  {i > 0 && <View style={[styles.moduleDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.moduleRow}>
                    <Ionicons name={m.icon} size={16} color={colors.text} />
                    <Text style={[styles.moduleLabel, { color: colors.text }]}>{m.label}</Text>
                    <Switch
                      value={modules[m.key]}
                      onValueChange={() => toggleModule(m.key)}
                      trackColor={{ true: colors.teal, false: colors.border }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              ))}
            </View>

            {editing && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.subtext, marginTop: 16 }]}>
                  Their own sources
                </Text>
                <View
                  style={[
                    styles.moduleList,
                    { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.connectRow}>
                    <Ionicons name="logo-google" size={16} color={colors.amber} />
                    <View style={styles.connectText}>
                      <Text style={[styles.moduleLabel, { color: colors.text }]}>Gmail</Text>
                      {emailConn && (
                        <Text style={[styles.connectMeta, { color: colors.subtext }]}>
                          {emailConn.address}
                        </Text>
                      )}
                    </View>
                    {emailConn ? (
                      <Pressable onPress={disconnectTheirEmail} hitSlop={6}>
                        <Text style={[styles.connectAction, { color: colors.danger }]}>
                          Disconnect
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={connectTheirEmail} disabled={connectingEmail} hitSlop={6}>
                        {connectingEmail ? (
                          <ActivityIndicator size="small" color={colors.teal} />
                        ) : (
                          <Text style={[styles.connectAction, { color: colors.teal }]}>
                            Connect
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>

                  <View style={[styles.moduleDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.connectRow}>
                    <Ionicons name="grid-outline" size={16} color={colors.text} />
                    <View style={styles.connectText}>
                      <Text style={[styles.moduleLabel, { color: colors.text }]}>Spreadsheet</Text>
                      {driveConn && (
                        <Text style={[styles.connectMeta, { color: colors.subtext }]}>
                          {driveConn.fileName}
                        </Text>
                      )}
                    </View>
                    {driveConn ? (
                      <Pressable onPress={disconnectTheirDrive} hitSlop={6}>
                        <Text style={[styles.connectAction, { color: colors.danger }]}>
                          Disconnect
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={connectTheirDrive} disabled={connectingDrive} hitSlop={6}>
                        {connectingDrive ? (
                          <ActivityIndicator size="small" color={colors.teal} />
                        ) : (
                          <Text style={[styles.connectAction, { color: colors.teal }]}>
                            Connect
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              </>
            )}
            </ScrollView>

            <View style={styles.modalActions}>
              <GhostButton
                label="Cancel"
                onPress={() => setFormOpen(false)}
                style={styles.modalButton}
              />
              <PrimaryButton
                label={saving ? 'Saving…' : 'Save'}
                onPress={save}
                style={styles.modalButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={removeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRemoveTarget(null)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            {removeTarget && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Remove {removeTarget.name}?
                </Text>
                <Text style={[styles.modalBody, { color: colors.subtext }]}>
                  They'll lose access to your leads, units, showings, and contacts immediately.
                </Text>
                <View style={styles.modalActions}>
                  <GhostButton
                    label="Cancel"
                    onPress={() => setRemoveTarget(null)}
                    style={styles.modalButton}
                  />
                  <Pressable
                    onPress={confirmRemove}
                    style={({ pressed }) => [
                      styles.dangerButton,
                      { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={styles.dangerLabel}>Remove</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={regenerateConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRegenerateConfirmOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRegenerateConfirmOpen(false)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Generate a new code?</Text>
            <Text style={[styles.modalBody, { color: colors.subtext }]}>
              The current code ({inviteCode?.code}) will stop working — anyone you already sent it
              to won't be able to use it anymore.
            </Text>
            <View style={styles.modalActions}>
              <GhostButton
                label="Cancel"
                onPress={() => setRegenerateConfirmOpen(false)}
                style={styles.modalButton}
              />
              <PrimaryButton label="Generate" onPress={regenerateCode} style={styles.modalButton} />
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
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  seatsCaption: { fontSize: 12.5, marginBottom: 8 },
  inviteCard: { borderRadius: radius.card, padding: 16, marginBottom: 12 },
  inviteTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  inviteBody: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  inviteActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  inviteActionButton: { flex: 1 },
  regenerateLink: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    paddingVertical: 14,
  },
  addButtonLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
  card: { borderRadius: radius.card, padding: 16, marginTop: 14 },
  cardClose: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 22 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '700' },
  personText: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '700' },
  personEmail: { fontSize: 13, marginTop: 2 },
  personModules: { fontSize: 12, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '88%', borderRadius: radius.card, padding: 20 },
  modalScroll: { maxHeight: 460 },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  modalBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  fieldError: { fontSize: 12, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  moduleList: { borderWidth: 1, borderRadius: radius.input, marginTop: 6, overflow: 'hidden' },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  moduleLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  moduleDivider: { height: 1, marginLeft: 12 },
  connectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  connectText: { flex: 1 },
  connectMeta: { fontSize: 12, marginTop: 1 },
  connectAction: { fontSize: 13, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1 },
  dangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
});
