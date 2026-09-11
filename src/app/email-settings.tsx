import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { connectEmail, disconnectEmail, getEmailConnection, getSettings, scanInbox } from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { sendLeadReplyNotification, sendNewLeadNotification } from '../notifications';
import { radius, useTheme } from '../theme';
import { AppSettings, EmailConnection } from '../types';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export default function EmailSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user } = useSession();
  const [connection, setConnection] = useState<EmailConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getEmailConnection().then(setConnection);
    getSettings().then(setSettings);
  }, []);

  const connect = async () => {
    if (!user) return;
    setConnecting(true);
    // TODO: this becomes the real Google OAuth consent screen (expo-auth-session)
    const conn = await connectEmail('gmail', user.email);
    setConnection(conn);
    setConnecting(false);
    toast(`Connected ${conn.address}`);
  };

  const disconnect = async () => {
    await disconnectEmail();
    setConnection(null);
    toast('Email disconnected');
  };

  const scan = async () => {
    setScanning(true);
    const result = await scanInbox();
    setConnection(await getEmailConnection());
    setScanning(false);
    if (result.newReplies.length > 0) {
      const [first] = result.newReplies;
      toast(
        result.newReplies.length === 1
          ? `${first.name} replied`
          : `${result.newReplies.length} leads replied`
      );
      if (settings) {
        await sendLeadReplyNotification(
          result.newReplies.map((r) => r.name),
          settings
        );
      }
    } else {
      toast(`Scanned ${result.scannedEmails} emails — ${result.leadsImported} leads imported`);
    }
    if (settings) await sendNewLeadNotification(result.leadsImported, settings);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Lead source</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {connection ? (
          <>
            <View style={styles.connRow}>
              <Ionicons name="logo-google" size={20} color={colors.amber} />
              <View style={styles.connText}>
                <Text style={[styles.connAddress, { color: colors.text }]}>
                  {connection.address}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>
                  {connection.lastScanAt
                    ? `Last scan ${timeAgo(connection.lastScanAt)}`
                    : 'Connected — not scanned yet'}
                </Text>
              </View>
              <Pill label="Connected" color={colors.teal} background={colors.tealSoft} />
            </View>

            <Pressable
              onPress={scan}
              disabled={scanning}
              style={({ pressed }) => [
                styles.scanButton,
                { backgroundColor: colors.teal, opacity: pressed || scanning ? 0.8 : 1 },
              ]}
            >
              {scanning ? (
                <IconLabel
                  leading={<ActivityIndicator color={colors.onTeal} size="small" />}
                  color={colors.onTeal}
                  label="Scanning your inbox…"
                  fontSize={14}
                  fontWeight="600"
                />
              ) : (
                <IconLabel
                  icon="sync-outline"
                  iconSize={17}
                  color={colors.onTeal}
                  label="Scan inbox now"
                  fontSize={14}
                  fontWeight="600"
                />
              )}
            </Pressable>
            <Text style={[styles.hint, { color: colors.faint }]}>
              Pulls new StreetEasy and Zillow lead emails into the Leads tab.
            </Text>

            <GhostButton label="Disconnect email" onPress={disconnect} style={{ marginTop: 10 }} />
          </>
        ) : (
          <>
            <Text style={[styles.connectTitle, { color: colors.text }]}>Connect your email</Text>
            <Text style={[styles.connectBody, { color: colors.subtext }]}>
              AgentEasy scans your inbox for StreetEasy and Zillow lead emails and turns them into
              lead cards — no forwarding rules, no copy-paste. Read access is used only for lead
              detection.
            </Text>
            <Pressable
              onPress={connect}
              disabled={connecting}
              style={({ pressed }) => [
                styles.connectButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.neutral,
                  opacity: pressed || connecting ? 0.7 : 1,
                },
              ]}
            >
              {connecting ? (
                <IconLabel
                  leading={<ActivityIndicator size="small" color={colors.teal} />}
                  color={colors.text}
                  label="Connecting to Google…"
                  fontSize={15}
                  fontWeight="600"
                />
              ) : (
                <IconLabel
                  icon="logo-google"
                  iconSize={18}
                  iconColor={colors.amber}
                  color={colors.text}
                  label="Connect Gmail"
                  fontSize={15}
                  fontWeight="600"
                />
              )}
            </Pressable>
            <Text style={[styles.hint, { color: colors.faint }]}>
              Outlook support coming later. You approve access on Google's own consent screen.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connText: { flex: 1 },
  connAddress: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.button,
    paddingVertical: 11,
    marginTop: 14,
  },
  scanLabel: { fontSize: 14, fontWeight: '600' },
  connectTitle: { fontSize: 17, fontWeight: '700' },
  connectBody: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
    marginTop: 14,
  },
  connectButtonLabel: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
});
