import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { radius } from '../theme';

interface PillProps {
  label: string;
  color: string; // text color
  background: string;
  style?: StyleProp<ViewStyle>;
}

/** Small rounded status/source label. */
export function Pill({ label, color, background, style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
