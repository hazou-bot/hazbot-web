import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  dismissNotification,
  getUnit,
  getUnitNotifications,
  getUnits,
  getUnitsSettings,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api';
import { useSetBadgeCount } from '../../badges';
import { GhostButton, IconLabel, PrimaryButton } from '../../components/buttons';
import { LinkifiedText } from '../../components/linkifiedText';
import { Pill } from '../../components/pill';
import { PressableCard } from '../../components/pressableCard';
import { useToast } from '../../components/toast';
import { composeSms } from '../../sms';
import {
  cardShadow,
  HEADER_ICON_SIZE,
  headerIconButton,
  headerRightRow,
  radius,
  useTheme,
} from '../../theme';
import { Unit, UnitNotification, UnitVisibility } from '../../types';

const STATUS_LABEL: Record<Unit['status'], string> = {
  available: 'Available',
  pending: 'Pending',
  taken: 'Taken',
};

function statusColors(status: Unit['status'], colors: ReturnType<typeof useTheme>) {
  if (status === 'available') return { color: colors.teal, background: colors.tealSoft };
  if (status === 'pending') return { color: colors.amber, background: colors.amberSoft };
  return { color: colors.danger, background: `${colors.danger}1A` };
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/**
 * Notification messages are one long sentence ("301 Graham Ave #2F just went Pending —
 * application in review..."). The status is redundant with the type-driven Pill shown
 * next to the address, so strip it off and keep just the address plus the "why" detail.
 */
function splitNotifMessage(n: UnitNotification): { address: string; detail: string | null } {
  const [headline, ...rest] = n.message.split(' — ');
  const suffix = n.type === 'taken' ? ' is now Taken' : ' just went Pending';
  const address = headline.endsWith(suffix) ? headline.slice(0, -suffix.length) : headline;
  return { address, detail: rest.length > 0 ? rest.join(' — ') : null };
}

const BED_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: 'Studio', value: 0 },
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3+', value: 3 },
] as const;

const BATH_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: '1+', value: 1 },
  { label: '1.5+', value: 1.5 },
  { label: '2+', value: 2 },
] as const;

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

export default function UnitsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [area, setArea] = useState('');
  const [beds, setBeds] = useState<number | undefined>(undefined);
  const [minBaths, setMinBaths] = useState<number | undefined>(undefined);
  const [visibility, setVisibilityState] = useState<UnitVisibility>('all');
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [priceSort, setPriceSort] = useState<'high' | 'low'>('high');
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<(UnitNotification & { read: boolean })[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<(UnitNotification & { read: boolean }) | null>(
    null
  );
  const [selectedNotifUnit, setSelectedNotifUnit] = useState<Unit | null>(null);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  // The maps-app chooser and tenant-contact chooser both used to be their own
  // <Modal>, stacked on top of the detail modal — two simultaneously-visible
  // native Modals is unreliable on iOS (the second one can fail to present),
  // so they're content swaps inside the single detail Modal instead, driven
  // by which "view" it's currently showing.
  const [modalView, setModalView] = useState<'detail' | 'directions' | 'tenant'>('detail');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const setBadgeCount = useSetBadgeCount('units');
  useEffect(() => {
    setBadgeCount(unreadCount);
  }, [unreadCount, setBadgeCount]);

  const performSearch = useCallback(
    async (vis: UnitVisibility) => {
      const results = await getUnits({
        maxPrice: maxPrice ? parseInt(maxPrice.replace(/[^0-9]/g, ''), 10) || undefined : undefined,
        moveIn: moveIn || undefined,
        area: area || undefined,
        beds,
        minBaths,
        status: vis === 'all' ? undefined : vis,
      });
      setUnits(results);
    },
    [maxPrice, moveIn, area, beds, minBaths]
  );

  // Only the Search button itself shows "Searching…" — the initial load, tab-focus
  // refetch, and header refresh button all call performSearch directly so the
  // button doesn't flash "Searching…" before the user has touched it.
  const search = async () => {
    setSearching(true);
    await performSearch(visibility);
    setSearching(false);
    setSearchOpen(false);
  };

  // Resets just this panel's filters (price/move-in/area/beds/baths) — the
  // separate Available/Pending/Taken visibility toggle lives outside this
  // dropdown and isn't part of what "clear search" refers to here.
  const clearSearch = async () => {
    setMaxPrice('');
    setMoveIn('');
    setArea('');
    setBeds(undefined);
    setMinBaths(undefined);
    setSearching(true);
    const results = await getUnits({ status: visibility === 'all' ? undefined : visibility });
    setUnits(results);
    setSearching(false);
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([getUnitNotifications().then(setNotifications), performSearch(visibility)]);
    setRefreshing(false);
  }, [performSearch, visibility]);

  useFocusEffect(
    useCallback(() => {
      getUnitNotifications().then(setNotifications);
      getUnitsSettings().then((s) => {
        setVisibilityState(s.visibility);
        performSearch(s.visibility);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const openNotification = async (n: UnitNotification & { read: boolean }) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    // Close the bell-list modal before opening this one — two native
    // <Modal>s visible at once is unreliable on real iOS (renders fine in
    // the web preview, which is why this slipped through).
    setBellOpen(false);
    setSelectedNotif(n);
    setSelectedNotifUnit(null);
    getUnit(n.unitId).then((u) => setSelectedNotifUnit(u ?? null));
  };

  const dismiss = async (id: string) => {
    await dismissNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openDirections = () => setModalView('directions');
  const closeDirections = () => setModalView('detail');
  const openTenantContact = () => setModalView('tenant');
  const closeTenantContact = () => setModalView('detail');
  const closeDetail = () => {
    setModalView('detail');
    setDetailUnit(null);
  };

  const chooseMapsApp = (provider: 'apple' | 'google') => {
    if (!detailUnit) return;
    const query = `${detailUnit.address} ${detailUnit.unit}, ${detailUnit.neighborhood}, NY`;
    const encoded = encodeURIComponent(query);
    const url =
      provider === 'apple'
        ? `http://maps.apple.com/?daddr=${encoded}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    closeDetail();
    Linking.openURL(url).catch(() =>
      toast(`Couldn't open ${provider === 'apple' ? 'Apple' : 'Google'} Maps`, 'error')
    );
  };

  const digitsOnly = (s: string) => s.replace(/\D/g, '');
  const callTenant = (phone: string) => Linking.openURL(`tel:${digitsOnly(phone)}`);
  const textTenant = async (phone: string) => {
    const outcome = await composeSms([phone], '');
    if (outcome === 'unavailable') {
      toast('Texting isn’t available in this browser — call instead.', 'error');
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={headerRightRow}>
          <Pressable
            onPress={() => setBellOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="notifications-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
            {unreadCount > 0 && (
              <View
                style={[
                  styles.bellBadge,
                  { backgroundColor: colors.danger, borderColor: colors.bg },
                ]}
              >
                <Text style={styles.bellBadgeLabel}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/units-settings')}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="settings-outline" size={HEADER_ICON_SIZE} color={colors.teal} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, colors, unreadCount, router]);

  const visible = useMemo(() => {
    if (!units) return [];
    return [...units].sort((a, b) =>
      priceSort === 'high' ? b.grossRent - a.grossRent : a.grossRent - b.grossRent
    );
  }, [units, priceSort]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  const chip = (
    label: string,
    active: boolean,
    onPress: () => void
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.teal : colors.cardAlt,
          borderColor: active ? colors.teal : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? colors.onTeal : colors.subtext }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
    <FlatList
      data={visible}
      keyExtractor={(u) => u.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal} />
      }
      ListHeaderComponent={
        <View style={styles.resultsRow}>
          <Text style={[styles.resultsCount, { color: colors.faint }]}>
            {visible.length} unit{visible.length === 1 ? '' : 's'}
          </Text>
          <Pressable
            onPress={() => setPriceSort((s) => (s === 'high' ? 'low' : 'high'))}
            style={({ pressed }) => [styles.sortButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="swap-vertical-outline" size={15} color={colors.teal} />
            <Text style={[styles.sortLabel, { color: colors.teal }]}>
              {priceSort === 'high' ? 'Price: High to low' : 'Price: Low to high'}
            </Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        units === null ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 32 }} />
        ) : (
          <Text style={[styles.empty, { color: colors.subtext }]}>
            No units match — try raising the price or widening the area.
          </Text>
        )
      }
      renderItem={({ item: unit }) => (
        <PressableCard onPress={() => setDetailUnit(unit)} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.address, { color: colors.text }]} numberOfLines={1}>
              {unit.address} {unit.unit}
            </Text>
            <Pill
              label={STATUS_LABEL[unit.status]}
              color={statusColors(unit.status, colors).color}
              background={statusColors(unit.status, colors).background}
            />
          </View>

          <Text style={[styles.price, { color: colors.teal }]}>
            {money(unit.grossRent)} gross
            {unit.netRent !== unit.grossRent && `  ·  ${money(unit.netRent)} net`}
          </Text>
          {unit.concession && (
            <Text style={[styles.concession, { color: colors.amber }]}>{unit.concession}</Text>
          )}

          <Text style={[styles.meta, { color: colors.subtext }]}>
            {unit.beds === 0 ? 'Studio' : `${unit.beds} bed`} · {unit.baths} bath ·{' '}
            {unit.neighborhood}
          </Text>
          <Text style={[styles.meta, { color: colors.subtext }]}>
            <Ionicons name="key-outline" size={13} color={colors.subtext} /> {unit.occupancy}
          </Text>

          <Pressable
            onPress={() => Linking.openURL(unit.streetEasyUrl)}
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: colors.neutral, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconLabel
              icon="open-outline"
              iconSize={15}
              color={colors.teal}
              label="View on StreetEasy"
              fontSize={14}
              fontWeight="600"
            />
          </Pressable>
        </PressableCard>
      )}
    />

    <View style={styles.searchFab} pointerEvents="box-none">
      <Pressable
        onPress={() => setSearchOpen(true)}
        style={({ pressed }) => [
          styles.searchFabButton,
          cardShadow,
          { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.onTeal} />
        <Text style={[styles.searchFabLabel, { color: colors.onTeal }]}>Search</Text>
      </Pressable>
    </View>

    <Modal
      visible={searchOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setSearchOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSearchOpen(false)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={styles.detailHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Search units</Text>
            <Pressable
              onPress={() => setSearchOpen(false)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.detailCloseButton,
                { backgroundColor: colors.cardAlt, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.subtext} />
            </Pressable>
          </View>

          <View style={[styles.inputRow, { marginTop: 14 }]}>
            <View style={styles.inputHalf}>
              <Text style={[styles.inputLabel, { color: colors.subtext }]}>Max price</Text>
              <TextInput
                style={inputStyle}
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="e.g. 3500"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={[styles.inputLabel, { color: colors.subtext }]}>Move-in by</Text>
              <TextInput
                style={inputStyle}
                value={moveIn}
                onChangeText={setMoveIn}
                placeholder="MM-DD"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.inputLabel, { color: colors.subtext }]}>Neighborhood or area</Text>
          <TextInput
            style={inputStyle}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Williamsburg, Greenpoint…"
            placeholderTextColor={colors.faint}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={search}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.inputLabel, { color: colors.subtext }]}>Beds</Text>
          <View style={styles.chips}>
            {BED_OPTIONS.map((opt) =>
              chip(opt.label, beds === opt.value, () => setBeds(opt.value))
            )}
          </View>

          <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 14 }]}>Baths</Text>
          <View style={styles.chips}>
            {BATH_OPTIONS.map((opt) =>
              chip(opt.label, minBaths === opt.value, () => setMinBaths(opt.value))
            )}
          </View>

          <View style={[styles.searchActions, { marginTop: 14 }]}>
            <GhostButton label="Clear search" onPress={clearSearch} style={styles.searchActionButton} />
            <PrimaryButton
              label={searching ? 'Searching…' : 'Search'}
              onPress={search}
              style={styles.searchActionButton}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={detailUnit !== null}
      transparent
      animationType="fade"
      onRequestClose={closeDetail}
    >
      <Pressable style={styles.modalBackdrop} onPress={closeDetail}>
        <Pressable
          style={[styles.unitDetailModalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {detailUnit && modalView === 'detail' && (
            <>
              <View style={[styles.unitModalHeader, { backgroundColor: colors.teal }]}>
                <Text style={[styles.unitModalName, { color: colors.onTeal }]}>
                  {detailUnit.address} {detailUnit.unit}
                </Text>
                <Text style={[styles.unitModalSubtitle, { color: colors.onTeal }]}>
                  {detailUnit.building} · {detailUnit.neighborhood}
                </Text>
                <View style={styles.unitModalPillWrap}>
                  <Pill
                    label={STATUS_LABEL[detailUnit.status]}
                    color={statusColors(detailUnit.status, colors).color}
                    background={colors.card}
                  />
                </View>

                <View style={styles.unitModalMetaList}>
                  <Text style={[styles.unitModalMetaRow, { color: colors.onTeal, fontWeight: '700' }]}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.onTeal} />{' '}
                    {money(detailUnit.grossRent)} gross
                    {detailUnit.netRent !== detailUnit.grossRent &&
                      ` · ${money(detailUnit.netRent)} net`}
                  </Text>
                  <Text style={[styles.unitModalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="calendar-outline" size={14} color={colors.onTeal} />{' '}
                    Move-in from{' '}
                    {new Date(`${detailUnit.availableFrom}T12:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  {detailUnit.concession && (
                    <Text style={[styles.unitModalMetaRow, { color: colors.onTeal }]}>
                      <Ionicons name="gift-outline" size={14} color={colors.onTeal} />{' '}
                      {detailUnit.concession}
                    </Text>
                  )}
                  <Text style={[styles.unitModalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="bed-outline" size={14} color={colors.onTeal} />{' '}
                    {detailUnit.beds === 0 ? 'Studio' : `${detailUnit.beds} bed`} /{' '}
                    {detailUnit.baths} bath
                  </Text>
                  <Text style={[styles.unitModalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="key-outline" size={14} color={colors.onTeal} />{' '}
                    {detailUnit.occupancy}
                  </Text>
                </View>
              </View>

              <View style={styles.unitActionsList}>
                <Pressable
                  onPress={openDirections}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="navigate" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]}>Get directions</Text>
                </Pressable>

                {detailUnit.tenantName && detailUnit.tenantPhone && (
                  <>
                    <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                    <Pressable
                      onPress={openTenantContact}
                      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
                        <Ionicons name="person" size={HEADER_ICON_SIZE} color={colors.text} />
                      </View>
                      <View style={styles.actionTextCol}>
                        <Text style={[styles.actionLabel, { color: colors.text }]}>Tenant</Text>
                        <Text style={[styles.actionSubtitle, { color: colors.faint }]} numberOfLines={1}>
                          {detailUnit.tenantName} · {detailUnit.tenantPhone}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                    </Pressable>
                  </>
                )}

                {detailUnit.accessNotes && (
                  <>
                    <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.actionRow}>
                      <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
                        <Ionicons name="lock-open" size={HEADER_ICON_SIZE} color={colors.text} />
                      </View>
                      <View style={styles.actionTextCol}>
                        <Text style={[styles.actionLabel, { color: colors.text }]}>Access</Text>
                        <LinkifiedText
                          text={detailUnit.accessNotes}
                          style={[styles.actionSubtitle, { color: colors.subtext }]}
                          beforeOpen={() => setDetailUnit(null)}
                        />
                      </View>
                    </View>
                  </>
                )}

                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => Linking.openURL(detailUnit.streetEasyUrl)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="open" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]}>View on StreetEasy</Text>
                </Pressable>
              </View>
            </>
          )}

          {detailUnit && modalView === 'directions' && (
            <View style={styles.subViewPad}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Get directions</Text>
              <Text style={[styles.modalRow, { color: colors.subtext, marginBottom: 14 }]}>
                {detailUnit.address} {detailUnit.unit} · {detailUnit.neighborhood}
              </Text>
              <Pressable
                onPress={() => chooseMapsApp('apple')}
                style={({ pressed }) => [
                  styles.mapChoiceButton,
                  { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <IconLabel
                  icon="logo-apple"
                  iconSize={18}
                  color={colors.text}
                  label="Apple Maps"
                  fontSize={15}
                  fontWeight="600"
                />
              </Pressable>
              <Pressable
                onPress={() => chooseMapsApp('google')}
                style={({ pressed }) => [
                  styles.mapChoiceButton,
                  { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1, marginTop: 10 },
                ]}
              >
                <IconLabel
                  icon="logo-google"
                  iconSize={17}
                  iconColor={colors.amber}
                  color={colors.text}
                  label="Google Maps"
                  fontSize={15}
                  fontWeight="600"
                />
              </Pressable>
              <GhostButton label="Back" onPress={closeDirections} style={{ marginTop: 14 }} />
            </View>
          )}

          {detailUnit && modalView === 'tenant' && detailUnit.tenantName && detailUnit.tenantPhone && (
            <View style={styles.subViewPad}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {detailUnit.tenantName}
              </Text>
              <Text style={[styles.modalRow, { color: colors.subtext, marginTop: 4, marginBottom: 14 }]}>
                {detailUnit.tenantPhone}
              </Text>
              <Pressable
                onPress={() => {
                  textTenant(detailUnit.tenantPhone!);
                  closeTenantContact();
                }}
                style={({ pressed }) => [
                  styles.mapChoiceButton,
                  { backgroundColor: colors.teal, borderColor: colors.teal, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <IconLabel
                  icon="chatbubble-outline"
                  iconSize={16}
                  color={colors.onTeal}
                  label="Text"
                  fontSize={15}
                  fontWeight="600"
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  callTenant(detailUnit.tenantPhone!);
                  closeTenantContact();
                }}
                style={({ pressed }) => [
                  styles.mapChoiceButton,
                  { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1, marginTop: 10 },
                ]}
              >
                <IconLabel
                  icon="call-outline"
                  iconSize={16}
                  color={colors.text}
                  label="Call"
                  fontSize={15}
                  fontWeight="600"
                />
              </Pressable>
              <GhostButton label="Cancel" onPress={closeTenantContact} style={{ marginTop: 14 }} />
            </View>
          )}

          {detailUnit && (
            <Pressable
              onPress={closeDetail}
              hitSlop={8}
              style={({ pressed }) => [
                styles.unitModalCloseButton,
                { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={HEADER_ICON_SIZE} color={colors.subtext} />
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={bellOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setBellOpen(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setBellOpen(false)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Unit updates</Text>
            {unreadCount > 0 && (
              <Pressable onPress={markAllRead} hitSlop={6}>
                <Text style={[styles.markAllLabel, { color: colors.teal }]}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {notifications.length === 0 ? (
            <Text style={[styles.notifEmpty, { color: colors.subtext }]}>
              No unit status changes yet.
            </Text>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={[styles.notifDivider, { backgroundColor: colors.border }]} />
              )}
              renderItem={({ item: n }) => {
                const { address, detail } = splitNotifMessage(n);
                return (
                <View style={[styles.notifRow, { opacity: n.read ? 0.55 : 1 }]}>
                  <Pressable
                    onPress={() => openNotification(n)}
                    style={({ pressed }) => [styles.notifRowBody, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      style={[
                        styles.notifDot,
                        {
                          backgroundColor: n.type === 'taken' ? colors.danger : colors.amber,
                          opacity: n.read ? 0 : 1,
                        },
                      ]}
                    />
                    <View style={styles.notifText}>
                      <View style={styles.notifHeadlineRow}>
                        <Pill
                          label={STATUS_LABEL[n.type]}
                          color={statusColors(n.type, colors).color}
                          background={statusColors(n.type, colors).background}
                        />
                        <Text style={[styles.notifAddress, { color: colors.text }]}>{address}</Text>
                      </View>
                      {detail && (
                        <Text style={[styles.notifDetail, { color: colors.subtext }]}>{detail}</Text>
                      )}
                      <Text style={[styles.notifTime, { color: colors.faint }]}>
                        {timeAgo(n.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => dismiss(n.id)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.notifDismiss, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <Ionicons name="close" size={17} color={colors.faint} />
                  </Pressable>
                </View>
                );
              }}
            />
          )}

          <GhostButton label="Close" onPress={() => setBellOpen(false)} style={{ marginTop: 14 }} />
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={selectedNotif !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedNotif(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSelectedNotif(null)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {selectedNotif && (
            <>
              <View style={styles.detailHeader}>
                <Pill
                  label={selectedNotif.type === 'taken' ? 'Taken' : 'Pending'}
                  color={selectedNotif.type === 'taken' ? colors.danger : colors.amber}
                  background={
                    selectedNotif.type === 'taken' ? `${colors.danger}1A` : colors.amberSoft
                  }
                />
                <Pressable
                  onPress={() => setSelectedNotif(null)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Ionicons name="close" size={22} color={colors.faint} />
                </Pressable>
              </View>

              <Text style={[styles.detailMessage, { color: colors.text }]}>
                {selectedNotif.message}
              </Text>
              <Text style={[styles.notifTime, { color: colors.faint, marginBottom: 4 }]}>
                {timeAgo(selectedNotif.createdAt)}
              </Text>

              <View style={[styles.notifDivider, { backgroundColor: colors.border }]} />

              {!selectedNotifUnit ? (
                <ActivityIndicator color={colors.teal} style={{ marginVertical: 12 }} />
              ) : (
                <View style={styles.modalRows}>
                  <Text style={[styles.detailAddress, { color: colors.text }]}>
                    {selectedNotifUnit.address} {selectedNotifUnit.unit}
                  </Text>
                  <Text style={[styles.modalRow, { color: colors.subtext }]}>
                    <Ionicons name="business-outline" size={14} color={colors.subtext} />{' '}
                    {selectedNotifUnit.building} · {selectedNotifUnit.neighborhood}
                  </Text>
                  <Text style={[styles.modalRow, { color: colors.subtext }]}>
                    <Ionicons name="pricetag-outline" size={14} color={colors.subtext} />{' '}
                    {money(selectedNotifUnit.grossRent)} gross
                    {selectedNotifUnit.netRent !== selectedNotifUnit.grossRent &&
                      ` · ${money(selectedNotifUnit.netRent)} net`}
                  </Text>
                  <Text style={[styles.modalRow, { color: colors.subtext }]}>
                    <Ionicons name="bed-outline" size={14} color={colors.subtext} />{' '}
                    {selectedNotifUnit.beds === 0 ? 'Studio' : `${selectedNotifUnit.beds} bed`} /{' '}
                    {selectedNotifUnit.baths} bath
                  </Text>
                  <Text style={[styles.modalRow, { color: colors.subtext }]}>
                    <Ionicons name="key-outline" size={14} color={colors.subtext} />{' '}
                    {selectedNotifUnit.occupancy}
                  </Text>

                  <Pressable
                    onPress={() => Linking.openURL(selectedNotifUnit.streetEasyUrl)}
                    style={({ pressed }) => [
                      styles.linkButton,
                      {
                        backgroundColor: colors.neutral,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                        marginTop: 8,
                      },
                    ]}
                  >
                    <IconLabel
                      icon="open-outline"
                      iconSize={15}
                      color={colors.teal}
                      label="View on StreetEasy"
                      fontSize={14}
                      fontWeight="600"
                    />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Extra bottom padding clears the floating "Search" pill so the last
  // card in the list is never hidden behind it. Top padding is deliberately
  // tight — now that the search card is gone, the results row is the very
  // first thing under the header and should sit close to it.
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 100, gap: 16 },
  searchFab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 12,
  },
  searchFabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  searchFabLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: { fontSize: 12, fontWeight: '600' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 14 },
  searchActions: { flexDirection: 'row', gap: 10 },
  searchActionButton: { flex: 1 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 14, paddingHorizontal: 24 },
  card: { padding: 18 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  address: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  price: { fontSize: 15, fontWeight: '600', marginTop: 6 },
  concession: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 13, marginTop: 6 },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 11,
    marginTop: 14,
  },
  linkLabel: { fontSize: 14, fontWeight: '600' },
  bellBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeLabel: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', lineHeight: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  markAllLabel: { fontSize: 13, fontWeight: '600' },
  notifEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  notifDivider: { height: 1, marginVertical: 4 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifRowBody: { flex: 1, flexDirection: 'row', gap: 10, paddingVertical: 10 },
  notifDismiss: { padding: 6 },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifText: { flex: 1 },
  notifHeadlineRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  notifAddress: { fontSize: 14.5, fontWeight: '700' },
  notifDetail: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  notifTime: { fontSize: 12, marginTop: 4 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailCloseButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMessage: { fontSize: 15, lineHeight: 21, fontWeight: '600', marginTop: 12 },
  detailAddress: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  detailSubtitle: { fontSize: 13.5, marginTop: 3 },
  modalRows: { gap: 7, marginTop: 4 },
  modalRow: { fontSize: 13.5, lineHeight: 19 },
  // Unit detail card — same shape as the Contacts detail card (teal banner
  // header with a floating close button, then a flat action-row list below).
  unitDetailModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  unitModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitModalHeader: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  unitModalName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  unitModalSubtitle: { fontSize: 13, marginTop: 3, opacity: 0.85 },
  unitModalPillWrap: { alignSelf: 'center', marginTop: 8 },
  unitModalMetaList: { alignSelf: 'stretch', marginTop: 18, gap: 8 },
  unitModalMetaRow: { fontSize: 13.5 },
  unitActionsList: { paddingHorizontal: 20, paddingVertical: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: { flex: 1 },
  actionLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionSubtitle: { fontSize: 12, marginTop: 2 },
  actionDivider: { height: 1, marginLeft: 34 },
  subViewPad: { padding: 20 },
  mapChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
  },
  mapChoiceLabel: { fontSize: 15, fontWeight: '600' },
});
