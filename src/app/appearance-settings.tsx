import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, AccentId, radius, useAccentMode, useResolvedScheme, useTheme } from '../theme';

export default function AppearanceSettingsScreen() {
  const colors = useTheme();
  const scheme = useResolvedScheme();
  const { accent, setAccent } = useAccentMode();
  const ids = Object.keys(ACCENTS) as AccentId[];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Accent color</Text>
      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.hint, { color: colors.subtext }]}>
          Choose the accent color used for buttons, links, and highlights throughout the app.
        </Text>
        <View style={styles.swatchRow}>
          {ids.map((id) => {
            const preset = ACCENTS[id][scheme];
            const selected = accent === id;
            return (
              <Pressable
                key={id}
                onPress={() => setAccent(id)}
                style={({ pressed }) => [styles.swatchWrap, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: preset.accent },
                    selected && { borderColor: colors.text },
                  ]}
                >
                  {selected && <Ionicons name="checkmark" size={20} color={preset.onAccent} />}
                </View>
                <Text style={[styles.swatchLabel, { color: colors.text }]}>
                  {ACCENTS[id].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
  swatchRow: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchWrap: { alignItems: 'center', gap: 8 },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchLabel: { fontSize: 12, fontWeight: '600' },
});
