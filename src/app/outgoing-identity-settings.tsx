import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getOutgoingSettings, updateOutgoingSettings } from '../api';
import { useSession } from '../auth/session';
import { useToast } from '../components/toast';
import { Identity, getPhoneIdentities } from '../identities';
import { cardShadow, radius, useTheme } from '../theme';
import { OutgoingSettings } from '../types';

export default function OutgoingIdentitySettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user } = useSession();
  const [phoneIdentities, setPhoneIdentities] = useState<Identity[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingSettings | null>(null);

  const load = useCallback(() => {
    getPhoneIdentities(user).then(setPhoneIdentities);
    getOutgoingSettings().then(setOutgoing);
  }, [user]);

  useFocusEffect(load);

  if (!phoneIdentities || !outgoing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const setPhoneIdentity = async (id: string) => {
    setOutgoing({ ...outgoing, phoneIdentityId: id });
    await updateOutgoingSettings({ phoneIdentityId: id });
    const identity = phoneIdentities.find((i) => i.id === id);
    toast(`Showing reminders now send as ${identity?.label}`);
  };

  const renderList = (
    identities: Identity[],
    selectedId: string,
    onSelect: (id: string) => void
  ) => (
    <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
      {identities.map((identity) => {
        const active = identity.id === selectedId;
        return (
          <Pressable
            key={identity.id}
            onPress={() => onSelect(identity.id)}
            style={[
              styles.option,
              {
                backgroundColor: active ? colors.tealSoft : colors.cardAlt,
                borderColor: active ? colors.teal : colors.border,
              },
            ]}
          >
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: active ? colors.teal : colors.text }]}>
                {identity.label}
              </Text>
              <Text style={[styles.optionSublabel, { color: active ? colors.teal : colors.subtext }]}>
                {identity.sublabel}
              </Text>
            </View>
            {active && <View style={[styles.checkDot, { backgroundColor: colors.teal }]} />}
          </Pressable>
        );
      })}
    </View>
  );

  if (phoneIdentities.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: colors.subtext }]}>
          This only matters once someone else is connected. Add a person in Shared Access and
          add their phone number, and you'll be able to pick who showing-reminder texts
          represent here. Lead email replies aren't picked here — they always send from
          whichever inbox actually received that lead, so the client only ever sees one sender.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Showing reminders send as</Text>
      {renderList(phoneIdentities, outgoing.phoneIdentityId, setPhoneIdentity)}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16 },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 24, textAlign: 'center', paddingHorizontal: 8 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: { borderRadius: radius.card, padding: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionSublabel: { fontSize: 12.5, marginTop: 2 },
  checkDot: { width: 8, height: 8, borderRadius: 4 },
});
