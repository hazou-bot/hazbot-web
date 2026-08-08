import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, useTheme } from '../theme';

export default function AboutSettingsScreen() {
  const colors = useTheme();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>About</Text>
      <View
        style={[styles.card, styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Pressable
          onPress={() => Linking.openURL('mailto:support@hazbot.app')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="help-buoy-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Contact support</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          onPress={() => Linking.openURL('https://hazbot.app/privacy')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy policy</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Pressable
          onPress={() => Linking.openURL('https://hazbot.app/terms')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowIcon}>
            <Ionicons name="document-text-outline" size={18} color={colors.text} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Terms of service</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="information-circle-outline" size={18} color={colors.faint} />
          </View>
          <Text style={[styles.rowLabel, { color: colors.faint }]}>Version {appVersion}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  groupCard: { paddingVertical: 12 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  rowIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  divider: { height: 1, marginLeft: 34 },
});
