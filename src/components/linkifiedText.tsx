import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { useContactSheet } from './contactSheet';

// Matches US-style phone numbers embedded in a free-text sentence, e.g.
// "call (718) 555-0199 thirty minutes ahead" — covers the formats already
// used across the app's mock data ("(718) 555-0199", "718-555-0244", "+1…").
const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Renders free text with any embedded phone numbers made tappable (opens
 * the shared Call/Text prompt) — for fields like Unit.accessNotes that are
 * an authored sentence rather than a structured phone field.
 */
export function LinkifiedText({
  text,
  style,
  name,
  beforeOpen,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  name?: string;
  /** Called right before the prompt opens — e.g. to close a parent Modal
   * this text lives inside. Two native Modals stacked at once render
   * unreliably (the newer one can paint behind the older one), so any
   * caller whose accessNotes/body text lives inside its own Modal must
   * close it here, matching the rest of the app's stacked-modal handling. */
  beforeOpen?: () => void;
}) {
  const colors = useTheme();
  const { promptPhone } = useContactSheet();

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(PHONE_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const phone = match[0];
    parts.push(
      <Text
        key={match.index}
        style={{ color: colors.teal }}
        onPress={() => {
          beforeOpen?.();
          promptPhone(phone, name);
        }}
      >
        {phone}
      </Text>
    );
    lastIndex = match.index + phone.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <Text style={style}>{parts}</Text>;
}
