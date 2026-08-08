import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

// react-native-web doesn't reliably keep a native-driven Animated.loop
// running past its first iteration — it freezes on the end frame instead
// of restarting. Native driver is fine (and preferred) on iOS/Android.
const LOOP_NATIVE_DRIVER = Platform.OS !== 'web';

import { useTheme } from '../theme';

export type LiveStatus = 'live' | 'loading' | 'error';

/** Green while the last inbox scan is current, yellow while a scan is
 * actively running, red when nothing has synced (no inbox connected, or a
 * scan has never completed). */
export function computeLiveStatus(
  connected: boolean,
  lastScanAt: string | null,
  isScanning: boolean
): LiveStatus {
  if (isScanning) return 'loading';
  if (!connected || !lastScanAt) return 'error';
  return 'live';
}

export function liveStatusLabel(status: LiveStatus): string {
  if (status === 'live') return 'Active';
  if (status === 'loading') return 'Updating...';
  return 'Error';
}

interface LiveStatusDotProps {
  status: LiveStatus;
  size?: number;
}

/** Small status dot with a soft breathing pulse — a ring that expands and
 * fades out from the dot on a loop — so it reads as "alive" rather than a
 * flat, static circle. Same treatment for every status, just recolored. See
 * computeLiveStatus for what each color means. */
export function LiveStatusDot({ status, size = 10 }: LiveStatusDotProps) {
  const colors = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const color =
    status === 'live' ? colors.teal : status === 'loading' ? colors.yellow : colors.danger;

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: LOOP_NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: size,
          elevation: 3,
        }}
      />
    </View>
  );
}
