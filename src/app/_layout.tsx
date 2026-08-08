import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { AppLockProvider, useAppLock } from '../appLock';
import { SessionProvider } from '../auth/session';
import { ContactSheetProvider } from '../components/contactSheet';
import { LockScreen } from '../components/lockScreen';
import { ToastProvider } from '../components/toast';
import {
  AccentProvider,
  HEADER_ICON_SIZE,
  headerIconButton,
  ThemeModeProvider,
  useResolvedScheme,
  useTheme,
} from '../theme';

export const unstable_settings = { anchor: '(tabs)' };

const HIGHLIGHTS = [
  { icon: 'mail-unread-outline', label: 'Leads sorted and ready to reply in seconds' },
  { icon: 'calendar-outline', label: 'Every showing tracked, confirmed, and reminded' },
  { icon: 'business-outline', label: 'Live unit inventory in one place' },
] as const;

/**
 * On web, render the app inside a centered phone-width column. Phone
 * browsers get it full-bleed (viewport is narrower than the column). On
 * desktop widths there's room to spare, so instead of a bare app column on
 * an empty backdrop, a brand panel fills the left side — the phone column
 * keeps the mobile design pixel-identical while the page reads as a real
 * website rather than an unstyled embed.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const scheme = useResolvedScheme();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return <>{children}</>;

  // Brand panel needs real room next to the 420px app column.
  const showBrandPanel = width >= 900;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'center',
        backgroundColor: scheme === 'dark' ? '#050505' : '#E9E7E1',
      }}
    >
      {showBrandPanel && (
        <View
          style={{
            flex: 1,
            maxWidth: 460,
            justifyContent: 'center',
            paddingHorizontal: 48,
            gap: 0,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.teal,
              marginBottom: 18,
            }}
          >
            <Ionicons name="home" size={30} color={colors.onTeal} />
          </View>
          <Text
            style={{
              fontSize: 34,
              fontWeight: '800',
              letterSpacing: -1,
              color: scheme === 'dark' ? '#F0F0EE' : '#0D1714',
            }}
          >
            Hazbot
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              marginTop: 8,
              color: scheme === 'dark' ? '#A3A3A3' : '#5C6763',
            }}
          >
            The lead cockpit built for one agent at a time.{'\n'}Leads in, deals out.
          </Text>
          <View style={{ marginTop: 28, gap: 14 }}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.tealSoft,
                  }}
                >
                  <Ionicons name={h.icon} size={16} color={colors.teal} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    lineHeight: 19,
                    fontWeight: '600',
                    color: scheme === 'dark' ? '#F0F0EE' : '#0D1714',
                  }}
                >
                  {h.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 420,
          backgroundColor: colors.bg,
          boxShadow: '0 0 32px rgba(16, 26, 23, 0.18)',
        }}
      >
        {children}
      </View>
      {/* Symmetry spacer so the app column stays visually centered on very
          wide screens instead of hugging the brand panel. */}
      {showBrandPanel && <View style={{ flex: 1, maxWidth: 460 }} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AccentProvider>
        <AppLockProvider>
          <RootLayoutInner />
        </AppLockProvider>
      </AccentProvider>
    </ThemeModeProvider>
  );
}

function RootLayoutInner() {
  const colors = useTheme();
  const scheme = useResolvedScheme();
  const router = useRouter();
  const { enabled: lockEnabled, unlocked } = useAppLock();

  return (
    <SessionProvider>
      <PhoneFrame>
      <ToastProvider>
      <ContactSheetProvider>
        {lockEnabled && !unlocked ? (
          <LockScreen />
        ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.teal,
            headerTitleStyle: {
              color: colors.text,
              fontWeight: '700',
              fontSize: 17,
            },
            headerShadowVisible: false,
            headerTitleAlign: 'center',
            contentStyle: { backgroundColor: colors.bg },
            // Every pushed screen gets an explicit themed back button. All
            // settings/detail screens use plain push (not 'modal') — modal
            // presentation's card-style peek-behind-the-previous-screen look
            // read as a rendering glitch rather than a deliberate transition.
            headerLeft: () =>
              router.canGoBack() ? (
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={({ pressed }) => [
                    headerIconButton,
                    { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1, marginLeft: 16 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={HEADER_ICON_SIZE} color={colors.teal} />
                </Pressable>
              ) : null,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="lead/[id]" options={{ title: 'Lead' }} />
          <Stack.Screen
            name="showings-settings"
            options={{ title: 'Showing settings' }}
          />
          <Stack.Screen
            name="showings-calendar"
            options={{ title: 'Calendar' }}
          />
          <Stack.Screen
            name="showings-history"
            options={{ title: 'Showing history' }}
          />
          <Stack.Screen
            name="route-planner"
            options={{ title: 'Route' }}
          />
          <Stack.Screen
            name="skipped-leads"
            options={{ title: 'Skipped leads' }}
          />
          <Stack.Screen
            name="favorite-contacts"
            options={{ title: 'Favorites' }}
          />
          <Stack.Screen
            name="leads-settings"
            options={{ title: 'Lead settings' }}
          />
          <Stack.Screen
            name="leads-history"
            options={{ title: 'Lead history' }}
          />
          <Stack.Screen
            name="leads-history/[id]"
            options={{ title: 'Thread' }}
          />
          <Stack.Screen
            name="subscription"
            options={{ title: 'Subscription' }}
          />
          <Stack.Screen
            name="units-settings"
            options={{ title: 'Unit visibility' }}
          />
          <Stack.Screen
            name="profile-settings"
            options={{ title: 'Profile' }}
          />
          <Stack.Screen
            name="appearance-settings"
            options={{ title: 'Appearance' }}
          />
          <Stack.Screen
            name="notification-settings"
            options={{ title: 'Notifications' }}
          />
          <Stack.Screen
            name="email-settings"
            options={{ title: 'Lead source' }}
          />
          <Stack.Screen
            name="drive-settings"
            options={{ title: 'Data source' }}
          />
          <Stack.Screen
            name="security-settings"
            options={{ title: 'Security' }}
          />
          <Stack.Screen
            name="privacy-settings"
            options={{ title: 'Data & privacy' }}
          />
          <Stack.Screen
            name="shared-access-settings"
            options={{ title: 'Shared access' }}
          />
          <Stack.Screen
            name="outgoing-identity-settings"
            options={{ title: 'Outgoing identity' }}
          />
          <Stack.Screen
            name="about-settings"
            options={{ title: 'About' }}
          />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          {/* Public, unauthenticated listing page — see
              src/app/listing/[token].tsx's header comment for why this is
              safe to register alongside welcome/login/signup: it never calls
              useSession() or pendingAuthRoute(), so nothing here redirects
              a signed-out visitor away. */}
          <Stack.Screen name="listing/[token]" options={{ headerShown: false }} />
          <Stack.Screen
            name="how-heard"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="paywall"
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </Stack>
        )}
      </ContactSheetProvider>
      </ToastProvider>
      </PhoneFrame>
      {/* Tied to the app's resolved theme, not the raw OS scheme — otherwise
          a manual Appearance override (e.g. forcing Dark while the OS is
          Light) picks status bar content for the OS's scheme and renders
          invisible dark-on-dark. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SessionProvider>
  );
}
