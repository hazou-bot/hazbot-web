import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppLock } from '../appLock';
import { cardShadow, useTheme } from '../theme';
import { PrimaryButton } from './buttons';

export function LockScreen() {
  const colors = useTheme();
  const { unlock } = useAppLock();

  // Prompt immediately when the lock screen appears, so the user isn't
  // forced to tap Unlock every single time if Face ID can just fire.
  useEffect(() => {
    unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.badge, cardShadow, { backgroundColor: colors.teal }]}>
        <Ionicons name="lock-closed" size={30} color={colors.onTeal} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>AgentEasy is locked</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        Unlock with Face ID to continue
      </Text>
      <PrimaryButton label="Unlock" onPress={unlock} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 6 },
  button: { marginTop: 22, minWidth: 180 },
});
