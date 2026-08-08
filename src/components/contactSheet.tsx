import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { composeSms } from '../sms';
import { cardShadow, radius, useTheme } from '../theme';
import { formatPhoneDisplay } from '../validation';
import { IconLabel } from './buttons';
import { useToast } from './toast';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

type ContactPrompt =
  | { kind: 'phone'; phone: string; name?: string }
  | { kind: 'email'; email: string; name?: string }
  | null;

interface ContactSheetContextValue {
  /** Opens the Call/Text/Cancel prompt for a phone number. */
  promptPhone: (phone: string, name?: string) => void;
  /** Opens the Open in Mail/Cancel prompt for an email address. */
  promptEmail: (email: string, name?: string) => void;
  /** Dials a number directly — no picker. */
  callPhone: (phone: string) => void;
  /** Opens the SMS composer directly — no picker. */
  textPhone: (phone: string) => Promise<void>;
  /** Opens the mail app directly — no picker. */
  emailAddress: (email: string) => void;
}

const ContactSheetContext = createContext<ContactSheetContextValue | null>(null);

/** `const { promptPhone, promptEmail } = useContactSheet();` — must be used within ContactSheetProvider (mounted once in _layout.tsx). */
export function useContactSheet(): ContactSheetContextValue {
  const ctx = useContext(ContactSheetContext);
  if (!ctx) throw new Error('useContactSheet must be used within ContactSheetProvider');
  return ctx;
}

/**
 * One shared prompt for every tappable phone number / email in the app, so
 * "call or text?" / "open in mail?" always looks and behaves the same
 * regardless of which screen it was tapped from.
 */
export function ContactSheetProvider({ children }: { children: React.ReactNode }) {
  const colors = useTheme();
  const toast = useToast();
  const [prompt, setPrompt] = useState<ContactPrompt>(null);

  const promptPhone = useCallback(
    (phone: string, name?: string) => setPrompt({ kind: 'phone', phone, name }),
    []
  );
  const promptEmail = useCallback(
    (email: string, name?: string) => setPrompt({ kind: 'email', email, name }),
    []
  );
  const close = () => setPrompt(null);

  const callPhone = useCallback((phone: string) => {
    Linking.openURL(`tel:${digitsOnly(phone)}`);
  }, []);

  const textPhone = useCallback(
    async (phone: string) => {
      const outcome = await composeSms([phone], '');
      if (outcome === 'unavailable') {
        toast('Texting isn’t available in this browser — call or email instead.', 'error');
      }
    },
    [toast]
  );

  const emailAddress = useCallback(
    (email: string) => {
      Linking.openURL(`mailto:${email}`).catch(() =>
        toast('No mail app configured on this device', 'error')
      );
    },
    [toast]
  );

  const call = () => {
    if (prompt?.kind === 'phone') callPhone(prompt.phone);
    close();
  };

  const text = async () => {
    if (prompt?.kind !== 'phone') return;
    const { phone } = prompt;
    close();
    await textPhone(phone);
  };

  const openMail = () => {
    if (prompt?.kind === 'email') emailAddress(prompt.email);
    close();
  };

  return (
    <ContactSheetContext.Provider value={{ promptPhone, promptEmail, callPhone, textPhone, emailAddress }}>
      {children}
      <Modal visible={prompt !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.card, cardShadow, { backgroundColor: colors.card }]} onPress={() => {}}>
            {prompt && (
              <>
                {prompt.name && <Text style={[styles.title, { color: colors.text }]}>{prompt.name}</Text>}
                <Text style={[styles.subtitle, { color: colors.subtext }]}>
                  {prompt.kind === 'phone' ? formatPhoneDisplay(prompt.phone) : prompt.email}
                </Text>
              </>
            )}

            {prompt?.kind === 'phone' && (
              <>
                <Pressable
                  onPress={text}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1, marginTop: 16 },
                  ]}
                >
                  <IconLabel icon="chatbubble-outline" iconSize={15} color={colors.onTeal} label="Text" fontSize={15} />
                </Pressable>
                <Pressable
                  onPress={call}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1, marginTop: 10 },
                  ]}
                >
                  <IconLabel icon="call-outline" iconSize={15} color={colors.onTeal} label="Call" fontSize={15} />
                </Pressable>
              </>
            )}
            {prompt?.kind === 'email' && (
              <Pressable
                onPress={openMail}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1, marginTop: 16 },
                ]}
              >
                <IconLabel icon="mail-outline" iconSize={15} color={colors.onTeal} label="Open in Mail" fontSize={15} />
              </Pressable>
            )}

            {/* Rendered last so it paints above the title/subtitle Text
                boxes — an earlier sibling here gets covered by their
                full-width (if empty) hit area and never receives taps,
                even though only the icon glyph is visible. */}
            <Pressable
              onPress={close}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.cardAlt, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={16} color={colors.subtext} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ContactSheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.card,
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center', marginTop: 6 },
  subtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  option: {
    borderRadius: radius.button,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
