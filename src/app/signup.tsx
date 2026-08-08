import { Ionicons } from '@expo/vector-icons';
import { Link, Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pendingAuthRoute } from '../auth/routing';
import { useSession } from '../auth/session';
import { useToast } from '../components/toast';
import { cardShadow, radius, useTheme } from '../theme';
import { capitalizeWords, isValidEmail } from '../validation';

export default function SignupScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user, loading, signUp, redeemInvite } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!loading && user) {
    return <Redirect href={pendingAuthRoute(user) ?? '/(tabs)'} />;
  }

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Fill in every field — password needs 6+ characters.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError('That doesn’t look like a valid email — double-check it.');
      return;
    }
    setError(null);
    setEmailError(null);
    setBusy(true);
    try {
      await signUp(name, email, password);
      if (inviteCode.trim()) {
        const result = await redeemInvite(inviteCode.trim(), name.trim(), email.trim());
        toast(
          result.ok
            ? `Joined ${result.ownerName}'s workspace — your trial's on them`
            : 'That invite code wasn’t recognized — continuing with a free trial',
          result.ok ? 'success' : 'warning'
        );
      }
    } catch {
      setError('Could not create the account — try again.');
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
  ];

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
        <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          Set up your cockpit, then connect your email to start pulling in leads.
        </Text>

        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.subtext }]}>Full name</Text>
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={(t) => setName(capitalizeWords(t))}
            placeholder="Harry Arzouman"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            autoComplete="name"
          />
          <Text style={[styles.label, { color: colors.subtext, marginTop: 14 }]}>Email</Text>
          <TextInput
            style={[inputStyle, emailError && { borderColor: colors.danger }]}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => {
              if (email.trim() && !isValidEmail(email)) {
                setEmailError('That doesn’t look like a valid email — double-check it.');
              }
            }}
            placeholder="you@brokerage.com"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {emailError && <Text style={[styles.fieldError, { color: colors.danger }]}>{emailError}</Text>}
          <Text style={[styles.label, { color: colors.subtext, marginTop: 14 }]}>Password</Text>
          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            placeholder="6+ characters"
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoComplete="new-password"
            onSubmitEditing={submit}
          />

          <Pressable
            onPress={() => setShowInviteCode((s) => !s)}
            hitSlop={6}
            style={styles.inviteToggle}
          >
            <Ionicons
              name={showInviteCode ? 'chevron-up' : 'add-circle-outline'}
              size={15}
              color={colors.teal}
            />
            <Text style={[styles.inviteToggleLabel, { color: colors.teal }]}>
              Have an invite code?
            </Text>
          </Pressable>
          {showInviteCode && (
            <TextInput
              style={[inputStyle, { marginTop: 8 }]}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="ABCD-1234"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
            />
          )}

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: colors.teal, opacity: pressed || busy ? 0.8 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onTeal} />
            ) : (
              <Text style={[styles.submitLabel, { color: colors.onTeal }]}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.subtext, fontSize: 14 }}>Already have an account? </Text>
          <Link href="/login">
            <Text style={{ color: colors.teal, fontSize: 14, fontWeight: '600' }}>Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  card: { borderRadius: radius.card, padding: 20 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  error: { fontSize: 13, marginTop: 12 },
  fieldError: { fontSize: 12, marginTop: 6 },
  submit: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  submitLabel: { fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  inviteToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  inviteToggleLabel: { fontSize: 13, fontWeight: '600' },
});
