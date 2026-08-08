import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { pendingAuthRoute } from '../../auth/routing';
import { useSession } from '../../auth/session';
import { BadgeProvider, useBadgeCounts } from '../../badges';
import { HeaderTitle } from '../../components/headerParts';
import { useTheme } from '../../theme';

/** Active tab: filled icon + a small pill indicator above it, like the Facebook tab bar.
 * `showDot` adds a small red notification dot at the icon's top-right corner —
 * cleared once the tab's own screen marks its unseen items as viewed. */
function TabIcon({
  focused,
  color,
  size,
  filled,
  outline,
  showDot,
  tabBarBackground,
}: {
  focused: boolean;
  color: string;
  size: number;
  filled: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  showDot?: boolean;
  /** Matches the dot's border to the tab bar so it reads as a notch cut into
   * the icon rather than a red square sitting on top of it. Only needed on
   * tabs that actually pass `showDot`. */
  tabBarBackground?: string;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {focused && (
        <View
          style={{
            position: 'absolute',
            top: -8,
            width: 28,
            height: 3,
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      )}
      <Ionicons name={focused ? filled : outline} size={size} color={color} />
      {showDot && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: '#E2725D',
            borderWidth: 1.5,
            borderColor: tabBarBackground,
          }}
        />
      )}
    </View>
  );
}

function TabsNavigator() {
  const colors = useTheme();
  const counts = useBadgeCounts();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.faint,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTitle: ({ children }) => <HeaderTitle>{children}</HeaderTitle>,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          height: 88,
          paddingTop: 8,
          shadowColor: '#0A1512',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              filled="mail"
              outline="mail-outline"
              showDot={counts.leads > 0}
              tabBarBackground={colors.card}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="showings"
        options={{
          title: 'Showings',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              filled="calendar"
              outline="calendar-outline"
              showDot={counts.showings > 0}
              tabBarBackground={colors.card}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="units"
        options={{
          title: 'Units',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              filled="business"
              outline="business-outline"
              showDot={counts.units > 0}
              tabBarBackground={colors.card}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              filled="people"
              outline="people-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              filled="person-circle"
              outline="person-circle-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const colors = useTheme();
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  const pending = pendingAuthRoute(user);
  if (pending) return <Redirect href={pending} />;

  return (
    <BadgeProvider>
      <TabsNavigator />
    </BadgeProvider>
  );
}
