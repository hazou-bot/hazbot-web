import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSession } from '../auth/session';
import { PrimaryButton } from '../components/buttons';
import { useToast } from '../components/toast';
import { radius, useTheme } from '../theme';
import { capitalizeWords } from '../validation';

export default function ProfileSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user, updateProfile } = useSession();
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editBrokerage, setEditBrokerage] = useState(user?.brokerage ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const profileDirty =
    editName.trim() !== (user?.name ?? '') || editBrokerage.trim() !== (user?.brokerage ?? '');

  const saveProfile = async () => {
    if (!editName.trim() || !editBrokerage.trim()) {
      toast('Name and brokerage can’t be empty', 'error');
      return;
    }
    setSavingProfile(true);
    await updateProfile({ name: editName.trim(), brokerage: editBrokerage.trim() });
    setSavingProfile(false);
    toast('Profile updated');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.tealSoft }]}>
            <Text style={[styles.avatarInitials, { color: colors.teal }]}>
              {(user?.name ?? 'A')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>{user?.email}</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>{user?.brokerage}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Edit profile</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.inputLabel, { color: colors.subtext }]}>Your name</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
          ]}
          value={editName}
          onChangeText={(t) => setEditName(capitalizeWords(t))}
          placeholder="Full name"
          placeholderTextColor={colors.faint}
          autoCapitalize="words"
        />
        <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>Brokerage</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
          ]}
          value={editBrokerage}
          onChangeText={setEditBrokerage}
          placeholder="Brokerage name"
          placeholderTextColor={colors.faint}
        />
        <Text style={[styles.hint, { color: colors.faint }]}>
          Used in your confirmation texts: “Hi, this is {editName.split(' ')[0] || '…'} from{' '}
          {editBrokerage || '…'}”
        </Text>
        {profileDirty && (
          <PrimaryButton
            label={savingProfile ? 'Saving…' : 'Save profile'}
            onPress={saveProfile}
            style={{ marginTop: 12 }}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 20, fontWeight: '700' },
  profileText: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 8, marginLeft: 4 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
