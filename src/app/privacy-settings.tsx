import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteAccount, requestDataExport } from '../api';
import { useSession } from '../auth/session';
import { useToast } from '../components/toast';
import { radius, useTheme } from '../theme';

export default function PrivacySettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { signOut } = useSession();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    await requestDataExport();
    setExporting(false);
    toast('Export requested — we’ll email it within 24 hours');
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your Hazbot account, leads, contacts, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await deleteAccount();
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Data & privacy</Text>
      <View
        style={[styles.card, styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Pressable
          onPress={exportData}
          disabled={exporting}
          style={({ pressed }) => [styles.row, { opacity: pressed || exporting ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="download-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {exporting ? 'Requesting export…' : 'Export my data'}
          </Text>
          {exporting && <ActivityIndicator size="small" color={colors.teal} />}
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          style={({ pressed }) => [styles.row, { opacity: pressed || deleting ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.danger }]}>
            {deleting ? 'Deleting account…' : 'Delete account'}
          </Text>
          {deleting && <ActivityIndicator size="small" color={colors.danger} />}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  // Rows already carry their own 12px paddingVertical, so the card only
  // needs to add the other half to make the edge gaps match the gaps
  // between rows — see account.tsx for the full rationale.
  groupCard: { paddingVertical: 12 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  rowIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  divider: { height: 1, marginLeft: 34 },
});
