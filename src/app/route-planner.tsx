import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getShowings } from '../api';
import { GhostButton, IconLabel, PrimaryButton } from '../components/buttons';
import { useToast } from '../components/toast';
import { cardShadow, HEADER_ICON_SIZE, headerIconButton, radius, useTheme } from '../theme';
import { Showing } from '../types';

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  if (iso === isoToday()) return "Today's route";
  const formatted = new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return `Route for ${formatted}`;
}

function timeToMinutes(time: string): number {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time.trim());
  if (!m) return 0;
  let hours = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(m[2]);
}

interface RouteStop {
  key: string;
  time: string;
  address: string;
  clients: string[];
}

// This mock app has no geocoding/routing API — this stands in for one with a
// deterministic estimate (same address pair always gives the same numbers),
// so reordering feels stable rather than random. "Open in Maps" hands off to
// a real map app for the actual drive time once the agent is ready to go.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function estimateLeg(from: string, to: string): { miles: number; minutes: number } {
  const seed = hashString(`${from}→${to}`);
  const miles = Math.round((0.4 + (seed % 640) / 100) * 10) / 10;
  const minutes = Math.max(3, Math.round(miles * 3 + (seed % 7)));
  return { miles, minutes };
}

export default function RoutePlannerScreen() {
  const colors = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const date = (Array.isArray(params.date) ? params.date[0] : params.date) ?? isoToday();

  // This screen is only ever reached from the Showings tab, but the generic
  // shared back button (router.back()) was landing on Leads instead —
  // dismissing a modal-presented screen resets the tab navigator to its
  // first tab rather than restoring whichever tab was active. Explicitly
  // routing back to Showings sidesteps that regardless of the underlying
  // navigation-state quirk.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => router.replace('/showings')}
          hitSlop={8}
          style={({ pressed }) => [
            headerIconButton,
            { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1, marginLeft: 16 },
          ]}
        >
          <Ionicons name="chevron-back" size={HEADER_ICON_SIZE} color={colors.teal} />
        </Pressable>
      ),
    });
  }, [navigation, router, colors]);

  const [stops, setStops] = useState<RouteStop[] | null>(null);
  const [mapsChoiceOpen, setMapsChoiceOpen] = useState(false);
  // Index of the stop Apple Maps last opened directions to, or null when not
  // mid-navigation. Apple's URL scheme can't carry multiple stops (verified —
  // see openGoogleRoute's comment), so instead of one broken link this steps
  // through stops one at a time: each tap opens Apple Maps fresh to just the
  // next address, which is the one thing Apple's scheme reliably supports.
  const [appleLegIndex, setAppleLegIndex] = useState<number | null>(null);

  // Drag-to-reorder, alongside the up/down arrows (kept as a fallback —
  // touch-drag gestures are hard to verify through a browser preview, so if
  // this ever misbehaves on a real device the arrows still work). Built on
  // PanResponder/Animated (core React Native) rather than a gesture library,
  // since those aren't used anywhere else in this app and have patchier web
  // support — this keeps drag testable in the same browser preview as
  // everything else.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const rowHeightRef = useRef(84);
  const stopsRef = useRef<RouteStop[] | null>(null);
  stopsRef.current = stops;
  // The drag handle and the ScrollView's own scroll gesture both want to
  // claim vertical drags — that fight is what read as "glitching." Two
  // countermeasures: claim the gesture at the *capture* phase (before it
  // ever reaches the ScrollView's bubble-phase responder), and hard-disable
  // scrolling for the duration of a drag so there's nothing left to compete.
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const setHover = (v: number | null) => {
    hoverIndexRef.current = v;
    setHoverIndex(v);
  };

  // One PanResponder per stop, created exactly once and reused for the life
  // of that stop — keyed by the stop's own stable `key`, not its array index.
  // The previous version called PanResponder.create() fresh inline on every
  // render, which is the actual root cause of the glitching: a real drag
  // fires many onPanResponderMove events, each one's setHover() triggers a
  // re-render, and *every* re-render was replacing the in-flight responder
  // with a brand-new instance that had never seen the gesture start — losing
  // the drag's internal tracking mid-motion. A single synthetic test move (as
  // opposed to a real continuous drag) never re-renders mid-gesture, which is
  // why this looked fine in automated testing but broke immediately for real
  // dragging, on both mouse and touch.
  const respondersRef = useRef<Map<string, ReturnType<typeof PanResponder.create>>>(new Map());
  // Requiring a brief hold before a drag "arms" lets a normal scroll swipe
  // pass through untouched — a real scroll moves right away, so it never
  // sits still long enough to satisfy the timer. This was the actual fix for
  // iOS specifically: without it, the OS's own scroll-vs-touch recognizer
  // was winning the very first frame of every touch on the handle, so the
  // drag would never even start.
  const HOLD_MS = 400;
  const MOVE_CANCEL_THRESHOLD = 10;
  const armedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const getDragResponder = (key: string) => {
    const existing = respondersRef.current.get(key);
    if (existing) return existing;
    const currentIndex = () => stopsRef.current?.findIndex((s) => s.key === key) ?? -1;
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Before the hold completes we haven't "claimed" the gesture for real
      // yet, so let anything that asks (the ScrollView, mainly) have it.
      // Once armed, refuse — that's what stopped the mid-drag hand-off that
      // used to abort the drag partway through.
      onPanResponderTerminationRequest: () => !armedRef.current,
      onPanResponderGrant: () => {
        armedRef.current = false;
        clearHoldTimer();
        holdTimerRef.current = setTimeout(() => {
          const index = currentIndex();
          if (index < 0) return;
          armedRef.current = true;
          dragY.setValue(0);
          setDraggingIndex(index);
          setHover(index);
          setScrollEnabled(false);
        }, HOLD_MS);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!armedRef.current) {
          // Moved before the hold finished — this is a scroll, not a
          // drag attempt. Cancel the timer so it never arms.
          if (
            Math.abs(gestureState.dy) > MOVE_CANCEL_THRESHOLD ||
            Math.abs(gestureState.dx) > MOVE_CANCEL_THRESHOLD
          ) {
            clearHoldTimer();
          }
          return;
        }
        const index = currentIndex();
        if (index < 0) return;
        dragY.setValue(gestureState.dy);
        const total = stopsRef.current?.length ?? 1;
        const shift = Math.round(gestureState.dy / rowHeightRef.current);
        setHover(Math.min(Math.max(index + shift, 0), total - 1));
      },
      onPanResponderRelease: () => {
        clearHoldTimer();
        if (!armedRef.current) return;
        armedRef.current = false;
        // Commit the reorder and clear the drag transform in the same
        // synchronous batch (React coalesces these into one re-render) —
        // gating the reorder on an Animated.spring completion callback was
        // tried and confirmed broken: react-native-web doesn't reliably fire
        // that callback, which left the card's displacement transform stuck
        // forever with the underlying list never actually reordering.
        const index = currentIndex();
        const to = hoverIndexRef.current;
        setStops((prev) => {
          if (!prev || to === null || index < 0 || to === index) return prev;
          const next = [...prev];
          const [moved] = next.splice(index, 1);
          next.splice(to, 0, moved);
          return next;
        });
        dragY.setValue(0);
        setDraggingIndex(null);
        setHover(null);
        setScrollEnabled(true);
      },
      onPanResponderTerminate: () => {
        clearHoldTimer();
        armedRef.current = false;
        dragY.setValue(0);
        setDraggingIndex(null);
        setHover(null);
        setScrollEnabled(true);
      },
    });
    respondersRef.current.set(key, responder);
    return responder;
  };

  useEffect(() => {
    let cancelled = false;
    getShowings().then((all) => {
      if (cancelled) return;
      const forDay = all.filter((s) => s.date === date);
      const groups = new Map<string, Showing[]>();
      for (const s of forDay) {
        const key = `${s.time}__${s.address}`;
        groups.set(key, [...(groups.get(key) ?? []), s]);
      }
      const built = [...groups.entries()]
        .map(([key, group]) => ({
          key,
          time: group[0].time,
          address: group[0].address,
          clients: group.map((s) => s.client),
        }))
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      setStops(built);
      setAppleLegIndex(null);
      respondersRef.current.clear();
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const legs = useMemo(() => {
    if (!stops) return [];
    return stops.slice(0, -1).map((s, i) => estimateLeg(s.address, stops[i + 1].address));
  }, [stops]);

  const totals = useMemo(
    () =>
      legs.reduce(
        (acc, leg) => ({ miles: acc.miles + leg.miles, minutes: acc.minutes + leg.minutes }),
        { miles: 0, minutes: 0 }
      ),
    [legs]
  );

  const moveStop = (index: number, direction: -1 | 1) => {
    setStops((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // Google's `waypoints` param is official and confirmed (tested live) to
  // route through every stop — the only option that opens the *full* route
  // in one link. Apple Maps' URL scheme has no such parameter; chaining
  // addresses with "+to:" (the old community workaround) was tested against
  // the real maps.apple.com endpoint and silently drops every stop but the
  // last, which is the bug this replaced.
  const openGoogleRoute = () => {
    if (!stops || stops.length < 2) return;
    setMapsChoiceOpen(false);
    const encoded = stops.map((s) => encodeURIComponent(s.address));
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded[encoded.length - 1]}&waypoints=${encoded.slice(0, -1).join('|')}`;
    Linking.openURL(url).catch(() => toast("Couldn't open Google Maps", 'error'));
  };

  // Apple Maps can only ever show one destination, so instead of a single
  // (broken) multi-stop link, this steps through stops one at a time — each
  // tap opens Apple Maps fresh to just the next address, which is the one
  // thing its URL scheme reliably supports.
  const openAppleLeg = (index: number) => {
    if (!stops) return;
    const encoded = encodeURIComponent(stops[index].address);
    Linking.openURL(`http://maps.apple.com/?daddr=${encoded}&dirflg=d`).catch(() =>
      toast("Couldn't open Apple Maps", 'error')
    );
  };

  const startAppleNavigation = () => {
    if (!stops || stops.length < 2) return;
    setMapsChoiceOpen(false);
    setAppleLegIndex(0);
    openAppleLeg(0);
  };

  const nextAppleLeg = () => {
    if (appleLegIndex === null || !stops) return;
    const next = appleLegIndex + 1;
    if (next >= stops.length) return;
    setAppleLegIndex(next);
    openAppleLeg(next);
  };

  if (!stops) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
    >
      <Text style={[styles.title, { color: colors.text }]}>{dayLabel(date)}</Text>

      {stops.length < 2 ? (
        <Text style={[styles.empty, { color: colors.subtext }]}>
          Add another showing on this day to plan a route between stops.
        </Text>
      ) : (
        <>
          <View style={[styles.summaryCard, cardShadow, { backgroundColor: colors.card }]}>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{stops.length}</Text>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>stops</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {Math.round(totals.miles * 10) / 10}
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>miles</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{totals.minutes}</Text>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>drive min</Text>
            </View>
          </View>

          <Text style={[styles.disclaimer, { color: colors.faint }]}>
            Distances and drive times are estimates. Reordering stops doesn't change your
            scheduled times — text clients if you need to adjust when you'll arrive. Open the
            route in Maps for live directions.
          </Text>

          {appleLegIndex !== null && (
            <View
              style={[
                styles.navCard,
                cardShadow,
                { backgroundColor: colors.tealSoft, borderColor: colors.teal },
              ]}
            >
              <View style={styles.navHeaderRow}>
                <Ionicons name="navigate" size={15} color={colors.teal} />
                <Text style={[styles.navHeaderLabel, { color: colors.teal }]}>
                  Navigating via Apple Maps — stop {appleLegIndex + 1} of {stops.length}
                </Text>
              </View>
              {appleLegIndex < stops.length - 1 ? (
                <PrimaryButton
                  label={`Next stop: ${stops[appleLegIndex + 1].address}`}
                  onPress={nextAppleLeg}
                  style={{ marginTop: 10 }}
                />
              ) : (
                <Text style={[styles.navDoneLabel, { color: colors.teal }]}>
                  Last stop — route complete.
                </Text>
              )}
              <PrimaryButton
                label="End navigation"
                onPress={() => setAppleLegIndex(null)}
                background={colors.danger}
                textColor="#FFFFFF"
                style={{ marginTop: 10 }}
              />
            </View>
          )}

          {stops.map((stop, i) => {
            const isDragging = draggingIndex === i;
            // Card + its trailing leg move together as one rigid block — the
            // leg used to be hidden mid-drag to dodge this exact problem, but
            // removing it from the layout entirely made every other row
            // reflow/snap tighter the instant a drag started, which read as
            // "glitching" and had nothing to do with the actual drag math.
            const displacement =
              draggingIndex !== null && hoverIndex !== null && !isDragging
                ? draggingIndex < hoverIndex && i > draggingIndex && i <= hoverIndex
                  ? -rowHeightRef.current
                  : draggingIndex > hoverIndex && i >= hoverIndex && i < draggingIndex
                    ? rowHeightRef.current
                    : 0
                : 0;
            return (
              <Animated.View
                key={stop.key}
                onLayout={(e) => {
                  if (i === 0) rowHeightRef.current = e.nativeEvent.layout.height;
                }}
                style={[
                  { transform: [{ translateY: isDragging ? dragY : displacement }] },
                  isDragging && { zIndex: 10 },
                ]}
              >
                <View
                  style={[
                    styles.stopCard,
                    cardShadow,
                    { backgroundColor: colors.card },
                    isDragging && { shadowOpacity: 0.3, elevation: 8 },
                  ]}
                >
                  <View style={[styles.stopBadge, { backgroundColor: colors.teal }]}>
                    <Text style={[styles.stopBadgeLabel, { color: colors.onTeal }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stopTime, { color: colors.teal }]}>{stop.time}</Text>
                    <Text style={[styles.stopAddress, { color: colors.text }]}>{stop.address}</Text>
                    <Text style={[styles.stopClients, { color: colors.subtext }]}>
                      {stop.clients.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.stopReorder}>
                    <Pressable
                      disabled={i === 0}
                      onPress={() => moveStop(i, -1)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.reorderButton, pressed && { opacity: 0.6 }]}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={16}
                        color={i === 0 ? colors.border : colors.teal}
                      />
                    </Pressable>
                    <Pressable
                      disabled={i === stops.length - 1}
                      onPress={() => moveStop(i, 1)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.reorderButton, pressed && { opacity: 0.6 }]}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={i === stops.length - 1 ? colors.border : colors.teal}
                      />
                    </Pressable>
                  </View>
                  <View {...getDragResponder(stop.key).panHandlers} style={styles.dragHandle}>
                    <Ionicons name="reorder-three-outline" size={20} color={colors.faint} />
                  </View>
                </View>

                {i < legs.length && (
                  <View style={styles.legRow}>
                    <View style={[styles.legLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.legLabel, { color: colors.faint }]}>
                      {legs[i].miles} mi · {legs[i].minutes} min (est.)
                    </Text>
                  </View>
                )}
              </Animated.View>
            );
          })}

          <PrimaryButton
            label="Open full route in Maps"
            onPress={() => setMapsChoiceOpen(true)}
            style={{ marginTop: 8 }}
          />
        </>
      )}

      <Modal
        visible={mapsChoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMapsChoiceOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMapsChoiceOpen(false)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Open in Maps</Text>

            <Pressable
              onPress={openGoogleRoute}
              style={({ pressed }) => [
                styles.mapChoiceButton,
                { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1 },
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
            <Text style={[styles.mapChoiceCaption, { color: colors.subtext }]}>
              Opens the full route with every stop.
            </Text>

            <Pressable
              onPress={startAppleNavigation}
              style={({ pressed }) => [
                styles.mapChoiceButton,
                { borderColor: colors.border, backgroundColor: colors.neutral, opacity: pressed ? 0.7 : 1, marginTop: 14 },
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
            <Text style={[styles.mapChoiceCaption, { color: colors.subtext }]}>
              Apple Maps can't show multiple stops at once — opens your first stop, then lets you
              tap through to each next one below.
            </Text>

            <GhostButton
              label="Cancel"
              onPress={() => setMapsChoiceOpen(false)}
              style={{ marginTop: 14 }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 12, lineHeight: 20 },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: radius.card,
    paddingVertical: 16,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11.5, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryDivider: { width: 1 },
  disclaimer: { fontSize: 12, lineHeight: 17, marginTop: 12, marginBottom: 18 },
  navCard: { borderRadius: radius.card, borderWidth: 1, padding: 14, marginBottom: 18 },
  navHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  navHeaderLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
  navDoneLabel: { fontSize: 14, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.card,
    padding: 14,
    userSelect: 'none',
  },
  stopBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeLabel: { fontSize: 13, fontWeight: '800' },
  stopTime: { fontSize: 13, fontWeight: '700' },
  stopAddress: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  stopClients: { fontSize: 12.5, marginTop: 2 },
  stopReorder: { gap: 2 },
  dragHandle: { paddingLeft: 8, paddingVertical: 8 },
  reorderButton: {
    width: 28,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 27,
    userSelect: 'none',
  },
  legLine: { width: 1, height: 18 },
  legLabel: { fontSize: 12, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: radius.card, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  mapChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
  },
  mapChoiceCaption: { fontSize: 12, lineHeight: 16, marginTop: 6 },
});
