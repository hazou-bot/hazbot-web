import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '../auth/session';
import { pendingAuthRoute } from '../auth/routing';
import { PrimaryButton } from '../components/buttons';
import { cardShadow, radius, useTheme } from '../theme';
import { HEAR_ABOUT_OPTIONS } from '../types';

export default function HowHeardScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { user, loading, setHearAboutSource } = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user?.hearAboutSource) {
    return <Redirect href={pendingAuthRoute(user) ?? '/(tabs)'} />;
  }

  const submit = async () => {
    const answer = selected === 'Other' ? otherText.trim() : selected;
    if (!answer) {
      setError(selected === 'Other' ? 'Type where you heard about us.' : 'Pick an option to continue.');
      return;
    }
    setError(null);
    setBusy(true);
    await setHearAboutSource(answer);
    setBusy(false);
    router.replace(pendingAuthRoute({ ...user!, hearAboutSource: answer }) ?? '/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badge, cardShadow, { backgroundColor: colors.teal }]}>
          <Ionicons name="megaphone" size={26} color={colors.onTeal} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>How’d you hear about Hazbot?</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Helps us understand what’s working so we can reach more agents like you.
        </Text>

        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          {HEAR_ABOUT_OPTIONS.map((option) => {
            const active = selected === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setSelected(option);
                  setError(null);
                }}
                style={[
                  styles.option,
                  {
                    borderColor: active ? colors.teal : colors.border,
                    backgroundColor: active ? colors.tealSoft : colors.cardAlt,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: active ? colors.teal : colors.border },
                    active && { backgroundColor: colors.teal },
                  ]}
                >
                  {active && <Ionicons name="checkmark" size={12} color={colors.onTeal} />}
                </View>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option}</Text>
              </Pressable>
            );
          })}

          {selected === 'Other' && (
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={otherText}
              onChangeText={setOtherText}
              placeholder="Tell us where"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          )}

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <PrimaryButton
            label={busy ? 'Saving…' : 'Continue'}
            onPress={submit}
            style={{ marginTop: 18 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  card: { borderRadius: radius.card, padding: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 14.5, fontWeight: '600', flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    marginTop: -2,
    marginBottom: 10,
  },
  error: { fontSize: 13, marginTop: 2, marginBottom: 4 },
});
