import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDriveConnection, getEmailConnection } from '../../api';
import { useSession } from '../../auth/session';
import { GhostButton } from '../../components/buttons';
import { Pill } from '../../components/pill';
import { getPlan } from '../../plans';
import {
  HEADER_ICON_SIZE,
  headerIconButton,
  headerRightRow,
  radius,
  ThemeColors,
  useResolvedScheme,
  useTheme,
  useThemeMode,
} from '../../theme';
import { PlanId } from '../../types';

/** Sun/moon toggle for the Account tab header — same size and shape as the
 * icon buttons every other tab's header uses, so it doesn't stand out as a
 * different kind of control. Tapping it always pins to an explicit light or
 * dark (never back to "system"), same as flipping a real light switch —
 * there's no in-between state to show. */
function ThemeToggle() {
  const colors = useTheme();
  const { setMode } = useThemeMode();
  const scheme = useResolvedScheme();
  const isDark = scheme === 'dark';

  return (
    <Pressable
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      hitSlop={8}
      style={({ pressed }) => [
        headerIconButton,
        { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={isDark ? 'moon' : 'sunny'} size={HEADER_ICON_SIZE} color={colors.teal} />
    </Pressable>
  );
}

/** Profile shortcut for the Account tab header — same icon-button shape as
 * every other header button, sitting right of the theme toggle. Moved out
 * of the row list below since it's the one destination worth a one-tap
 * shortcut from the header rather than a scroll down the page. */
function ProfileButton() {
  const colors = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/profile-settings')}
      hitSlop={8}
      style={({ pressed }) => [
        headerIconButton,
        { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="person-circle-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
    </Pressable>
  );
}

/** One distinct color per tier so the badge itself hints which plan you're
 * on at a glance, not just the label text — basic stays neutral, pro reuses
 * the app's teal brand accent, premium gets its own gold so it doesn't read
 * as the same "Canceling" amber used elsewhere on this screen. */
function planBadgeColors(planId: PlanId | undefined, colors: ThemeColors) {
  switch (planId) {
    case 'pro':
      return { color: colors.teal, background: colors.tealSoft };
    case 'premium':
      return { color: colors.yellow, background: `${colors.yellow}26` };
    default:
      return { color: colors.subtext, background: colors.cardAlt };
  }
}

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
  trailing?: React.ReactNode;
}

export default function AccountScreen() {
  const colors = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, signOut } = useSession();
  const [emailConnected, setEmailConnected] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getEmailConnection().then((c) => setEmailConnected(c !== null));
      getDriveConnection().then((c) => setDriveConnected(c !== null));
    }, [])
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={headerRightRow}>
          <ThemeToggle />
          <ProfileButton />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountRows: SettingsRow[] = [
    { icon: 'notifications-outline', label: 'Notifications', href: '/notification-settings' },
    { icon: 'lock-closed-outline', label: 'Security', href: '/security-settings' },
    { icon: 'shield-checkmark-outline', label: 'Data & privacy', href: '/privacy-settings' },
  ];

  const planBadge = user?.cancelAtPeriodEnd
    ? { color: colors.amber, background: colors.amberSoft }
    : planBadgeColors(user?.plan, colors);

  const billingRows: SettingsRow[] = [
    {
      icon: 'card-outline',
      label: 'Subscription',
      href: '/subscription',
      trailing: (
        <Pill
          label={user?.cancelAtPeriodEnd ? 'Canceling' : getPlan(user?.plan).label}
          color={planBadge.color}
          background={planBadge.background}
        />
      ),
    },
  ];

  const teamRows: SettingsRow[] = [
    { icon: 'people-circle-outline', label: 'Shared access', href: '/shared-access-settings' },
    { icon: 'swap-horizontal-outline', label: 'Outgoing identity', href: '/outgoing-identity-settings' },
  ];

  const dataRows: SettingsRow[] = [
    {
      icon: 'mail-outline',
      label: 'Lead source',
      href: '/email-settings',
      trailing: (
        <Pill
          label={emailConnected ? 'Connected' : 'Not connected'}
          color={emailConnected ? colors.teal : colors.yellow}
          background={emailConnected ? colors.tealSoft : `${colors.yellow}26`}
        />
      ),
    },
    {
      icon: 'grid-outline',
      label: 'Data source',
      href: '/drive-settings',
      trailing: (
        <Pill
          label={driveConnected ? 'Connected' : 'Not connected'}
          color={driveConnected ? colors.teal : colors.yellow}
          background={driveConnected ? colors.tealSoft : `${colors.yellow}26`}
        />
      ),
    },
  ];

  const appRows: SettingsRow[] = [
    { icon: 'color-palette-outline', label: 'Appearance', href: '/appearance-settings' },
    { icon: 'information-circle-outline', label: 'About', href: '/about-settings' },
  ];

  const renderGroup = (rows: SettingsRow[]) => (
    <View
      style={[styles.card, styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {rows.map((row, i) => (
        <React.Fragment key={row.label}>
          <Pressable
            onPress={() => router.push(row.href as never)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name={row.icon} size={19} color={colors.subtext} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
            {row.trailing}
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
          {i < rows.length - 1 && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionHeader, { color: colors.subtext }, styles.firstSectionHeader]}>
        Account
      </Text>
      {renderGroup(accountRows)}

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Billing</Text>
      {renderGroup(billingRows)}

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Team</Text>
      {renderGroup(teamRows)}

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>Data sources</Text>
      {renderGroup(dataRows)}

      <Text style={[styles.sectionHeader, { color: colors.subtext }]}>App</Text>
      {renderGroup(appRows)}

      <GhostButton label="Sign out" onPress={() => signOut()} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  // Rows already carry their own 12px paddingVertical on each side, so the
  // card only needs to add the other half (12) to make the gap above the
  // first row and below the last row match the gap between rows exactly —
  // the shared `card` style's padding: 16 was adding too much on those two
  // edges only, reading as extra whitespace next to the tighter row gaps.
  groupCard: { paddingVertical: 12 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  // The first header used to sit below the email pill's own marginBottom;
  // now that the pill is gone, drop its marginTop so it doesn't stack an
  // extra gap on top of the container's own paddingTop.
  firstSectionHeader: { marginTop: 0 },
  // Fixed height (not minHeight) + overflow: hidden so the icon slot is a
  // hard-clipped 24px box on every platform — some Ionicons glyphs (e.g.
  // notifications-outline) render with extra line-height on iOS that a
  // minHeight-only box wouldn't stop from stretching the row. 24px matches
  // the trailing value text's own rendered height, so pinning it here keeps
  // every row's internal padding — and so the gaps between rows — uniform
  // too, not just the outer row height.
  rowIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  divider: { height: 1, marginLeft: 36 },
});
