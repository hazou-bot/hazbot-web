import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { changePassword } from '../api';
import { useAppLock } from '../appLock';
import { GhostButton, PrimaryButton } from '../components/buttons';
import { useToast } from '../components/toast';
import { getBiometricLabel, isBiometricAvailable } from '../security';
import { cardShadow, radius, useTheme } from '../theme';

export default function SecuritySettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { enabled: appLockEnabled, setEnabled: setAppLockEnabled } = useAppLock();
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [biometricAvailable, setBiometricAvailable] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    getBiometricLabel().then(setBiometricLabel);
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const toggleAppLock = async (value: boolean) => {
    if (value && !biometricAvailable) {
      toast(`${biometricLabel} isn’t set up on this device`, 'error');
      return;
    }
    await setAppLockEnabled(value);
    toast(value ? `${biometricLabel} lock enabled` : `${biometricLabel} lock disabled`);
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalOpen(true);
  };

  const savePassword = async () => {
    if (!currentPassword || newPassword.length < 6) {
      toast('Enter your current password and a new one (6+ characters)', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords don’t match', 'error');
      return;
    }
    setSavingPassword(true);
    await changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    setPasswordModalOpen(false);
    toast('Password updated');
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Security</Text>
      <View
        style={[styles.card, styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.switchRow}>
          <View style={styles.rowIcon}>
            <Ionicons name="finger-print-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{biometricLabel} lock</Text>
            <Text style={[styles.switchHint, { color: colors.faint }]}>
              {biometricAvailable
                ? `Require ${biometricLabel} to open AgentEasy`
                : `${biometricLabel} isn’t set up on this device`}
            </Text>
          </View>
          <Switch
            value={appLockEnabled}
            onValueChange={toggleAppLock}
            trackColor={{ true: colors.teal, false: colors.border }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          onPress={openPasswordModal}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="key-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Change password</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      </View>
    </ScrollView>

    <Modal
      visible={passwordModalOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setPasswordModalOpen(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Change password</Text>

          <Text style={[styles.inputLabel, { color: colors.subtext }]}>Current password</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.faint}
            secureTextEntry
          />

          <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>
            New password
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="6+ characters"
            placeholderTextColor={colors.faint}
            secureTextEntry
          />

          <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>
            Confirm new password
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="6+ characters"
            placeholderTextColor={colors.faint}
            secureTextEntry
            onSubmitEditing={savePassword}
          />

          <View style={styles.modalActions}>
            <GhostButton
              label="Cancel"
              onPress={() => setPasswordModalOpen(false)}
              style={styles.modalButton}
            />
            <PrimaryButton
              label={savingPassword ? 'Saving…' : 'Save'}
              onPress={savePassword}
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  // Rows carry their own 11px paddingVertical (row normalized to match
  // switchRow below), so the card only needs to add the other half to make
  // the edge gaps match the between-row gaps.
  groupCard: { paddingVertical: 11 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  rowIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  switchText: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  switchHint: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  divider: { height: 1, marginLeft: 34 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
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
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1 },
});
