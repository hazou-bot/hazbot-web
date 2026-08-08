import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import * as api from '../api';
import { PlanId, User } from '../types';

const STORAGE_KEY = 'hazbot.session';

interface SessionState {
  user: User | null;
  loading: boolean; // true until AsyncStorage has been checked
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'brokerage'>>) => Promise<void>;
  setHearAboutSource: (source: string) => Promise<void>;
  subscribe: (plan: PlanId) => Promise<void>;
  changePlan: (plan: PlanId) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  /** Redeems a teammate's invite code for the *current* session's user —
   * call right after signUp/signIn with that same name/email, since the
   * invite is tied to whoever's redeeming it, not a separately-typed identity. */
  redeemInvite: (code: string, name: string, email: string) => Promise<{ ok: boolean; ownerName?: string }>;
}

const SessionContext = createContext<SessionState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  setHearAboutSource: async () => {},
  subscribe: async () => {},
  changePlan: async () => {},
  cancelSubscription: async () => {},
  resumeSubscription: async () => {},
  redeemInvite: async () => ({ ok: false }),
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = async (u: User | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await api.signIn(email, password);
    await persist(u);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const u = await api.signUp(name, email, password);
    await persist(u);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    await persist(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'brokerage'>>) => {
      if (!user) return;
      const next = await api.updateProfile({ ...user, ...patch });
      await persist(next);
    },
    [user]
  );

  const setHearAboutSource = useCallback(async (source: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, hearAboutSource: source };
      api.updateProfile(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const subscribe = useCallback(async (plan: PlanId) => {
    await api.subscribe(plan);
    setUser((prev) => {
      if (!prev) return prev;
      const next: User = {
        ...prev,
        subscribed: true,
        plan,
        subscribedAt: new Date().toISOString(),
        cancelAtPeriodEnd: false,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const changePlan = useCallback(async (plan: PlanId) => {
    await api.changePlan(plan);
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, plan };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const cancelSubscription = useCallback(async () => {
    await api.cancelSubscription();
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, cancelAtPeriodEnd: true };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resumeSubscription = useCallback(async () => {
    await api.resumeSubscription();
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, cancelAtPeriodEnd: false };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const redeemInvite = useCallback(async (code: string, name: string, email: string) => {
    const result = await api.redeemInviteCode(code, { name, email });
    if (result.ok) {
      setUser((prev) => {
        if (!prev) return prev;
        const next: User = {
          ...prev,
          subscribed: true,
          subscribedAt: new Date().toISOString(),
          cancelAtPeriodEnd: false,
          joinedViaInvite: true,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
    return result;
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        setHearAboutSource,
        subscribe,
        changePlan,
        cancelSubscription,
        resumeSubscription,
        redeemInvite,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
