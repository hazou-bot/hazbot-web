import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getUnitsSettings, updateUnitsSettings } from '../api';
import { useToast } from '../components/toast';
import { cardShadow, radius, useTheme } from '../theme';
import { UnitsSettings, UnitVisibility } from '../types';

const VISIBILITY_OPTIONS: { label: string; value: UnitVisibility }[] = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Pending', value: 'pending' },
  { label: 'Taken', value: 'taken' },
];

export default function UnitsSettingsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<UnitsSettings | null>(null);

  useEffect(() => {
    getUnitsSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const setVisibility = async (visibility: UnitVisibility) => {
    setSettings({ ...settings, visibility });
    await updateUnitsSettings({ visibility });
    const label = VISIBILITY_OPTIONS.find((o) => o.value === visibility)?.label ?? visibility;
    toast(`Showing ${label.toLowerCase()} units`);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Which units to show</Text>
      <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
        {VISIBILITY_OPTIONS.map((opt) => {
          const active = settings.visibility === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setVisibility(opt.value)}
              style={[
                styles.option,
                {
                  backgroundColor: active ? colors.tealSoft : colors.cardAlt,
                  borderColor: active ? colors.teal : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.optionLabel, { color: active ? colors.teal : colors.text }]}
              >
                {opt.label}
              </Text>
              {active && (
                <View style={[styles.checkDot, { backgroundColor: colors.teal }]} />
              )}
            </Pressable>
          );
        })}
        <Text style={[styles.hint, { color: colors.faint }]}>
          Controls which units show by default on the Units tab. "All" includes available,
          pending, and taken.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16 },
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
  optionLabel: { fontSize: 15, fontWeight: '600' },
  checkDot: { width: 8, height: 8, borderRadius: 4 },
  hint: { fontSize: 12, marginTop: 4, lineHeight: 17 },
});
