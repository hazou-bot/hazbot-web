import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { cardShadow, radius, useTheme } from '../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

interface PrimaryButtonProps extends ButtonProps {
  /** Defaults to brand teal — pass e.g. `colors.yellow` for a secondary filled variant (Skip, Reschedule). */
  background?: string;
  /** Defaults to `colors.onTeal` — pair with `background` for readable contrast. */
  textColor?: string;
}

/** Filled action button — teal by default. Uses the same neutral shadow as
 * every other surface (cards, toasts) rather than a colored glow matching
 * the button's own fill — the colored-glow look read as off/washed-out
 * against the dark theme's saturation. */
export function PrimaryButton({ label, onPress, style, background, textColor }: PrimaryButtonProps) {
  const colors = useTheme();
  const bg = background ?? colors.teal;
  const fg = textColor ?? colors.onTeal;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        cardShadow,
        { backgroundColor: bg },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

interface GhostButtonProps extends ButtonProps {
  /** Defaults to `colors.subtext` — pass e.g. `colors.danger` for a destructive action like "End navigation". */
  textColor?: string;
}

/** Quiet secondary button on a subtle surface. */
export function GhostButton({ label, onPress, style, textColor }: GhostButtonProps) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.neutral },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor ?? colors.subtext }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Icon + label content for a button, with the label truly centered instead
 * of the icon+label pair centered as one block. A leading icon otherwise
 * pushes the visual "text mass" off-center by roughly half the icon+gap
 * width (measured ~11px on a typical button here) — noticeable next to any
 * icon-less button in the same stack. The icon is pinned to a fixed left
 * inset (out of flow via `position: absolute`) so it never affects where
 * the label sits. Drop this inside any Pressable — it only renders content,
 * not a button shell, so it composes with every existing button style
 * (filled, outlined, danger, etc.) without changing them.
 */
export function IconLabel({
  icon,
  iconSize = 16,
  iconColor,
  leading,
  color,
  label,
  fontSize = 16,
  fontWeight = '700',
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  /** Defaults to `color` — set only when the icon and label are two-toned. */
  iconColor?: string;
  /** A custom leading element (e.g. an `ActivityIndicator` while loading) instead of `icon`. */
  leading?: React.ReactNode;
  color: string;
  label: string;
  fontSize?: number;
  fontWeight?: TextStyle['fontWeight'];
}) {
  return (
    <View style={iconLabelStyles.row}>
      <View style={iconLabelStyles.iconSlot}>
        {leading ?? (icon && <Ionicons name={icon} size={iconSize} color={iconColor ?? color} />)}
      </View>
      <Text style={[iconLabelStyles.label, { color, fontSize, fontWeight }]}>{label}</Text>
    </View>
  );
}

const iconLabelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconSlot: { position: 'absolute', left: 16 },
  label: { letterSpacing: -0.2, textAlign: 'center' },
});

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
