import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardShadow, radius, useTheme } from '../theme';

export type ToastKind = 'success' | 'warning' | 'error';

const KIND_META: Record<
  ToastKind,
  { title: string; icon: keyof typeof Ionicons.glyphMap; colorKey: 'teal' | 'yellow' | 'danger' }
> = {
  success: { title: 'Success', icon: 'checkmark-circle', colorKey: 'teal' },
  warning: { title: 'Warning', icon: 'alert-circle', colorKey: 'yellow' },
  error: { title: 'Error', icon: 'close-circle', colorKey: 'danger' },
};

type ShowToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Show a transient confirmation message: `const toast = useToast(); toast('Sent!')` */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<ToastKind>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const shownOnPath = useRef(pathname);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setMessage(null)
    );
  }, [opacity]);

  const show = useCallback<ShowToast>(
    (msg, toastKind = 'success') => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      shownOnPath.current = pathname;
      setMessage(msg);
      setKind(toastKind);
      scale.setValue(0.9);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
      ]).start();
      // A two-line title+message toast takes longer to read than the old
      // single-line one — and now that there's a manual X, there's no harm
      // in giving it more time before the auto-dismiss kicks in.
      hideTimer.current = setTimeout(hide, 2200);
    },
    [opacity, scale, pathname, hide]
  );

  // Leaving the screen the toast was raised on (new tab, a modal, back, …)
  // clears it instantly instead of letting it linger over the new screen.
  useEffect(() => {
    if (pathname !== shownOnPath.current) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(null);
      opacity.setValue(0);
    }
  }, [pathname, opacity]);

  const meta = KIND_META[kind];
  const kindColor = colors[meta.colorKey];

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null && (
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingBottom: insets.bottom + 78 }]}
        >
          <Animated.View
            style={[
              styles.toast,
              cardShadow,
              {
                opacity,
                transform: [{ scale }],
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.iconBadge, { backgroundColor: kindColor }]}>
              <Ionicons name={meta.icon} size={18} color="#FFFFFF" />
            </View>
            <View style={styles.textCol}>
              <Text style={[styles.title, { color: kindColor }]}>{meta.title}</Text>
              <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
            </View>
            <Pressable onPress={hide} hitSlop={10} style={styles.closeButton}>
              <Ionicons name="close" size={16} color={colors.faint} />
            </Pressable>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
  toast: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
