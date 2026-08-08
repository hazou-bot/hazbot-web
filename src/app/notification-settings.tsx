import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { getSettings, updateSettings } from '../api';
import { useToast } from '../components/toast';
import { ensurePermission } from '../notifications';
import { radius, useTheme } from '../theme';
import { AppSettings } from '../types';

export default function NotificationSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const toggleSetting = async (key: keyof AppSettings, value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateSettings({ [key]: value });
    if (value && (key === 'newLeadAlerts' || key === 'showingReminders')) {
      const granted = await ensurePermission();
      if (!granted) toast('Notifications are off in iOS Settings — enable them to get alerts', 'warning');
    }
  };

  const toggleSettingText = async (key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateSettings({ [key]: value });
  };

  if (!settings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Notifications</Text>
      <View
        style={[styles.card, styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="mail-unread-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>New lead alerts</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Ping me the moment a lead email arrives
            </Text>
          </View>
          <Switch
            value={settings.newLeadAlerts ?? true}
            onValueChange={(v) => toggleSetting('newLeadAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="arrow-undo-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Lead replies</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a client replies to a message
            </Text>
          </View>
          <Switch
            value={settings.leadReplyAlerts ?? true}
            onValueChange={(v) => toggleSetting('leadReplyAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="alarm-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Showing reminders</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Remind me before each showing
            </Text>
          </View>
          <Switch
            value={settings.showingReminders ?? true}
            onValueChange={(v) => toggleSetting('showingReminders', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.settingsGroup, { color: colors.text, marginLeft: 34 }]}>
          Activity alerts
        </Text>
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Reminder sent</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a showing reminder text goes out
            </Text>
          </View>
          <Switch
            value={settings.reminderSentAlerts ?? true}
            onValueChange={(v) => toggleSetting('reminderSentAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="paper-plane-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Reply sent</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a lead reply script goes out
            </Text>
          </View>
          <Switch
            value={settings.replySentAlerts ?? true}
            onValueChange={(v) => toggleSetting('replySentAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="add-circle-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>New units</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a new unit shows up in the workbook
            </Text>
          </View>
          <Switch
            value={settings.newUnitAlerts ?? true}
            onValueChange={(v) => toggleSetting('newUnitAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="time-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Unit pending</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a unit just went pending
            </Text>
          </View>
          <Switch
            value={settings.unitPendingAlerts ?? true}
            onValueChange={(v) => toggleSetting('unitPendingAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Unit closed</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Notify me when a unit closes and is final
            </Text>
          </View>
          <Switch
            value={settings.unitClosedAlerts ?? true}
            onValueChange={(v) => toggleSetting('unitClosedAlerts', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.settingsGroup, { color: colors.text, marginLeft: 34 }]}>
          Quiet hours
        </Text>
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="moon-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Mute overnight</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              Pause new-lead pushes between these hours
            </Text>
          </View>
          <Switch
            value={settings.quietHoursEnabled ?? false}
            onValueChange={(v) => toggleSetting('quietHoursEnabled', v)}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>
        {settings.quietHoursEnabled && (
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={[styles.inputLabel, { color: colors.subtext }]}>From</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={settings.quietHoursStart}
                onChangeText={(v) => toggleSettingText('quietHoursStart', v)}
                placeholder="10:00 PM"
                placeholderTextColor={colors.faint}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={[styles.inputLabel, { color: colors.subtext }]}>To</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                ]}
                value={settings.quietHoursEnd}
                onChangeText={(v) => toggleSettingText('quietHoursEnd', v)}
                placeholder="8:00 AM"
                placeholderTextColor={colors.faint}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  // Rows carry their own 11px paddingVertical, so the card only needs to
  // add the other half to make the edge gaps match the between-row gaps.
  groupCard: { paddingVertical: 11 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  settingsGroup: { fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 10 },
  rowIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  switchText: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  switchHint: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginLeft: 34 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  inputHalf: { flex: 1 },
});
