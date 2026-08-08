import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { cardShadow, cardShadowPressed, radius, useTheme } from '../theme';

interface PressableCardProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's standard tappable card surface — settles down (tighter shadow +
 * slight scale) on press instead of just dimming, for a more premium feel.
 * On web, hovering with a mouse lifts the card slightly so desktop users
 * get the same "this is tappable" affordance a finger gets from the press
 * animation (hover events simply never fire on touch, so this is inert on
 * phones and native).
 */
export function PressableCard({ style, children, ...props }: PressableCardProps) {
  const colors = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...props}
      onHoverIn={(e) => {
        setHovered(true);
        props.onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        props.onHoverOut?.(e);
      }}
      style={({ pressed }) => [
        { backgroundColor: colors.card, borderRadius: radius.card },
        pressed ? cardShadowPressed : cardShadow,
        pressed && { transform: [{ scale: 0.985 }] },
        !pressed && hovered && { transform: [{ scale: 1.008 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
