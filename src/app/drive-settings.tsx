import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { connectDrive, disconnectDrive, getDriveConnection, getSettings, syncDrive } from '../api';
import { useSession } from '../auth/session';
import { GhostButton, IconLabel } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { sendUnitActivityNotification } from '../notifications';
import { radius, useTheme } from '../theme';
import { AppSettings, DriveConnection } from '../types';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export default function DriveSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user } = useSession();
  const [driveConnection, setDriveConnection] = useState<DriveConnection | null>(null);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getDriveConnection().then(setDriveConnection);
    getSettings().then(setSettings);
  }, []);

  const connectDriveSheet = async () => {
    if (!user) return;
    setDriveConnecting(true);
    // TODO: this becomes the real Google OAuth + Drive file picker
    // (expo-auth-session, drive.readonly + spreadsheets.readonly scopes).
    const conn = await connectDrive('Units Inventory', user.email);
    setDriveConnection(conn);
    setDriveConnecting(false);
    toast(`Connected ${conn.fileName}`);
  };

  const disconnectDriveSheet = async () => {
    await disconnectDrive();
    setDriveConnection(null);
    toast('Google Drive disconnected');
  };

  const syncDriveSheet = async () => {
    setDriveSyncing(true);
    const result = await syncDrive();
    setDriveConnection(await getDriveConnection());
    setDriveSyncing(false);
    if (result.activity) {
      const verb =
        result.activity.type === 'new'
          ? 'added'
          : result.activity.type === 'pending'
            ? 'went pending'
            : 'closed';
      toast(`${result.activity.unitLabel} ${verb}`);
      if (settings) await sendUnitActivityNotification(result.activity, settings);
    } else {
      toast(`Synced ${result.rowsSynced} rows from your workbook`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Data source</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {driveConnection ? (
          <>
            <View style={styles.connRow}>
              <Ionicons name="grid-outline" size={20} color={colors.teal} />
              <View style={styles.connText}>
                <Text style={[styles.connAddress, { color: colors.text }]}>
                  {driveConnection.fileName}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>
                  {driveConnection.lastSyncAt
                    ? `Last synced ${timeAgo(driveConnection.lastSyncAt)}`
                    : 'Connected — not synced yet'}
                </Text>
              </View>
              <Pill label="Connected" color={colors.teal} background={colors.tealSoft} />
            </View>

            <Pressable
              onPress={syncDriveSheet}
              disabled={driveSyncing}
              style={({ pressed }) => [
                styles.scanButton,
                { backgroundColor: colors.teal, opacity: pressed || driveSyncing ? 0.8 : 1 },
              ]}
            >
              {driveSyncing ? (
                <IconLabel
                  leading={<ActivityIndicator color={colors.onTeal} size="small" />}
                  color={colors.onTeal}
                  label="Syncing your workbook…"
                  fontSize={14}
                  fontWeight="600"
                />
              ) : (
                <IconLabel
                  icon="sync-outline"
                  iconSize={17}
                  color={colors.onTeal}
                  label="Sync now"
                  fontSize={14}
                  fontWeight="600"
                />
              )}
            </Pressable>
            <Text style={[styles.hint, { color: colors.faint }]}>
              Pulls the latest rows from your connected sheet into the Units tab.
            </Text>

            <GhostButton
              label="Disconnect Google Drive"
              onPress={disconnectDriveSheet}
              style={{ marginTop: 10 }}
            />
          </>
        ) : (
          <>
            <Text style={[styles.connectTitle, { color: colors.text }]}>Connect Google Drive</Text>
            <Text style={[styles.connectBody, { color: colors.subtext }]}>
              Link a Google Sheet from Drive (or Google One storage) and Hazbot reads your unit
              inventory workbook directly — no manual re-entry when rows change.
            </Text>
            <Pressable
              onPress={connectDriveSheet}
              disabled={driveConnecting}
              style={({ pressed }) => [
                styles.connectButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.neutral,
                  opacity: pressed || driveConnecting ? 0.7 : 1,
                },
              ]}
            >
              {driveConnecting ? (
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
                  label="Connect Google Drive"
                  fontSize={15}
                  fontWeight="600"
                />
              )}
            </Pressable>
            <Text style={[styles.hint, { color: colors.faint }]}>
              You'll pick the exact spreadsheet on Google's own file picker — Hazbot only gets
              read access to that one file.
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
