import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { authenticate } from './security';

const APP_LOCK_KEY = 'hazbot.appLockEnabled';

interface AppLockState {
  enabled: boolean;
  unlocked: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
}

const AppLockContext = createContext<AppLockState>({
  enabled: false,
  unlocked: true,
  setEnabled: async () => {},
  unlock: async () => true,
});

export function useAppLock() {
  return useContext(AppLockContext);
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem(APP_LOCK_KEY).then((v) => {
      const isEnabled = v === 'true';
      setEnabledState(isEnabled);
      setUnlocked(!isEnabled); // locked at cold start if the setting is on
    });
  }, []);

  // Re-lock whenever the app leaves the foreground, so backgrounding it
  // (not just force-quitting) is enough to require Face ID again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (enabled && /active/.test(appState.current) && /inactive|background/.test(next)) {
        setUnlocked(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled]);

  const setEnabled = async (value: boolean) => {
    setEnabledState(value);
    if (!value) setUnlocked(true);
    await AsyncStorage.setItem(APP_LOCK_KEY, value ? 'true' : 'false');
  };

  const unlock = async () => {
    const ok = await authenticate('Unlock AgentEasy');
    if (ok) setUnlocked(true);
    return ok;
  };

  return (
    <AppLockContext.Provider value={{ enabled, unlocked, setEnabled, unlock }}>
      {children}
    </AppLockContext.Provider>
  );
}
