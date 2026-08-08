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
import { isValidEmail } from '../validation';

export default function LoginScreen() {
  const colors = useTheme();
  const toast = useToast();
  const { user, loading, signIn, redeemInvite } = useSession();
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
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
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
      await signIn(email, password);
      if (inviteCode.trim()) {
        const result = await redeemInvite(inviteCode.trim(), '', email.trim());
        toast(
          result.ok
            ? `Joined ${result.ownerName}'s workspace`
            : 'That invite code wasn’t recognized',
          result.ok ? 'success' : 'error'
        );
      }
    } catch {
      setError('Could not sign in — try again.');
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
        <View style={styles.brand}>
          <View style={[styles.logoBadge, cardShadow, { backgroundColor: colors.teal }]}>
            <Ionicons name="home" size={30} color={colors.onTeal} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Hazbot</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            Your lead cockpit. Leads in, deals out.
          </Text>
        </View>

        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.subtext }]}>Email</Text>
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
            placeholder="••••••••"
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoComplete="password"
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
              <Text style={[styles.submitLabel, { color: colors.onTeal }]}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.subtext, fontSize: 14 }}>New to Hazbot? </Text>
          <Link href="/signup">
            <Text style={{ color: colors.teal, fontSize: 14, fontWeight: '600' }}>
              Create an account
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, marginTop: 6, letterSpacing: -0.1 },
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
