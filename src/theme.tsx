import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Hazbot design system.
 * Warm-neutral background, deep-teal + burnt-amber accents.
 */
export const palette = {
  light: {
    bg: '#F6F5F2',
    card: '#FFFFFF',
    cardAlt: '#F8F7F4',
    text: '#0D1714',
    subtext: '#5C6763',
    faint: '#98A29D',
    border: '#ECEAE4',
    // A clearly-visible neutral grey — for secondary button fills and
    // received-message bubbles. cardAlt/border read as almost the same
    // tone as bg, which made grey buttons ("Open in email", "Get
    // directions", etc.) nearly invisible; this is a deliberate step darker.
    neutral: '#DFDBD2',
    teal: '#0E8A6E',
    onTeal: '#FFFFFF',
    tealSoft: '#DFF3EB',
    amber: '#C77E2E',
    onAmber: '#FFFFFF',
    amberSoft: '#F9EEDE',
    yellow: '#C9A227',
    danger: '#D2452E',
    inputBg: '#FFFFFF',
    bubbleUser: '#0E8A6E',
    bubbleAssistant: '#FFFFFF',
  },
  dark: {
    // True neutral charcoal — no green/blue cast, unlike the previous
    // dark-with-a-hue-tint palette Harry found hard on the eyes.
    bg: '#121212',
    card: '#1C1C1C',
    cardAlt: '#242424',
    text: '#F0F0EE',
    subtext: '#A3A3A3',
    faint: '#707070',
    border: '#2E2E2E',
    // See light.neutral — same purpose, a step lighter than border/cardAlt
    // so grey buttons and received-message bubbles actually read as their
    // own surface against the dark background instead of blending in.
    neutral: '#3D3D3D',
    // Accents pulled back from neon-bright to a calmer, less saturated tone.
    teal: '#4CB894',
    onTeal: '#08211A',
    tealSoft: '#1B332B',
    amber: '#D69A5C',
    onAmber: '#241505',
    amberSoft: '#332812',
    yellow: '#DCB955',
    danger: '#E2725D',
    inputBg: '#242424',
    bubbleUser: '#4CB894',
    bubbleAssistant: '#1C1C1C',
  },
};

export type ThemeColors = typeof palette.light;

/**
 * Accent color presets — swap the app's brand trio (teal/onTeal/tealSoft)
 * for an alternate hue while every other palette value (bg, card, text,
 * borders, amber, danger, ...) stays fixed. Each preset follows the same
 * design language as the original teal: a deep saturated color with white
 * text in light mode, a softer/lighter version with dark text in dark mode
 * (teal itself is kept as the 'teal' preset so it round-trips exactly).
 */
export type AccentId = 'teal' | 'blue' | 'purple' | 'rose';

interface AccentTriple {
  accent: string;
  onAccent: string;
  accentSoft: string;
}

export const ACCENTS: Record<AccentId, { label: string; light: AccentTriple; dark: AccentTriple }> = {
  teal: {
    label: 'Teal',
    light: { accent: '#0E8A6E', onAccent: '#FFFFFF', accentSoft: '#DFF3EB' },
    dark: { accent: '#4CB894', onAccent: '#08211A', accentSoft: '#1B332B' },
  },
  blue: {
    label: 'Blue',
    light: { accent: '#1D6FE0', onAccent: '#FFFFFF', accentSoft: '#E1EBFB' },
    dark: { accent: '#6FA8F0', onAccent: '#0B2036', accentSoft: '#1B2C40' },
  },
  purple: {
    label: 'Purple',
    light: { accent: '#7C4FD4', onAccent: '#FFFFFF', accentSoft: '#ECE3FA' },
    dark: { accent: '#B48EEA', onAccent: '#241938', accentSoft: '#2C2440' },
  },
  rose: {
    label: 'Rose',
    light: { accent: '#C43D74', onAccent: '#FFFFFF', accentSoft: '#FAE1EC' },
    dark: { accent: '#E890B4', onAccent: '#331420', accentSoft: '#3A2028' },
  },
};

const ACCENT_KEY = 'hazbot.accentColor';

const AccentContext = createContext<{
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}>({ accent: 'teal', setAccent: () => {} });

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>('teal');

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_KEY).then((v) => {
      if (v && v in ACCENTS) setAccentState(v as AccentId);
    });
  }, []);

  const setAccent = (next: AccentId) => {
    setAccentState(next);
    AsyncStorage.setItem(ACCENT_KEY, next);
  };

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>
  );
}

/** Read/write the user's selected accent color preset. */
export function useAccentMode() {
  return useContext(AccentContext);
}

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODE_KEY = 'hazbot.themeMode';

const ThemeModeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}>({ mode: 'system', setMode: () => {} });

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next);
  };

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>
  );
}

/** Read/write the user's Appearance preference (System / Light / Dark). */
export function useThemeMode() {
  return useContext(ThemeModeContext);
}

/** The app's actual rendered scheme — the user's Appearance override (if not
 * "System") takes precedence over the OS setting. Anything that needs to know
 * light-vs-dark (theme colors, the native status bar) must read this instead
 * of the raw `useColorScheme()`, or it'll desync from what's on screen when
 * the override disagrees with the OS (e.g. status bar text picked for a
 * light OS while the app itself is forced into Dark, rendering invisible
 * dark-on-dark). */
export function useResolvedScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const { mode } = useContext(ThemeModeContext);
  const effective = mode === 'system' ? system : mode;
  return effective === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeColors {
  const scheme = useResolvedScheme();
  const { accent } = useContext(AccentContext);
  const base = scheme === 'dark' ? palette.dark : palette.light;
  const a = ACCENTS[accent][scheme];
  return { ...base, teal: a.accent, onTeal: a.onAccent, tealSoft: a.accentSoft };
}

export const radius = { card: 20, pill: 999, button: 14, input: 14 };

/** Resting elevation for tappable/static surfaces — deeper and softer for a premium feel. */
export const cardShadow = {
  shadowColor: '#0A1512',
  shadowOpacity: 0.11,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 5,
} as const;

/** Tighter, quieter shadow used while a card is actively pressed — reads as the card settling down. */
export const cardShadowPressed = {
  shadowColor: '#0A1512',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

/**
 * Shared tab-header icon-button sizing — every header on every tab now has the
 * exact same shape (centered plain title, only right-side icons, nothing in
 * headerLeft) so the app doesn't feel different from screen to screen. Buttons
 * are flat soft-background circles, no border/shadow — quiet, not competing
 * with the title.
 */
export const HEADER_ICON_SIZE = 20;
export const headerIconButton = {
  width: 36,
  height: 36,
  borderRadius: radius.pill,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
export const headerRightRow = {
  flexDirection: 'row',
  alignItems: 'center',
  // >= 2x each button's hitSlop(8) so adjacent tap zones never overlap.
  gap: 16,
  marginRight: 16,
} as const;
