import React, { createContext, useCallback, useContext, useState } from 'react';

/**
 * Red tab-bar notification dots for Leads/Units/Showings. Each tab screen
 * reports its own unseen count in here (it's the only place that knows what
 * "unseen" means for that tab — a real notification feed for Units, a
 * viewed-detail flag for Leads/Showings); (tabs)/_layout.tsx just reads the
 * totals to decide whether to render a dot on each tab's icon.
 */
export interface BadgeCounts {
  leads: number;
  units: number;
  showings: number;
}

const ZERO_COUNTS: BadgeCounts = { leads: 0, units: 0, showings: 0 };

const BadgeContext = createContext<{
  counts: BadgeCounts;
  setCount: (key: keyof BadgeCounts, value: number) => void;
}>({
  counts: ZERO_COUNTS,
  setCount: () => {},
});

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<BadgeCounts>(ZERO_COUNTS);

  const setCount = useCallback((key: keyof BadgeCounts, value: number) => {
    setCounts((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  return <BadgeContext.Provider value={{ counts, setCount }}>{children}</BadgeContext.Provider>;
}

export function useBadgeCounts(): BadgeCounts {
  return useContext(BadgeContext).counts;
}

/** Call the returned function with a tab's current unseen count whenever it changes. */
export function useSetBadgeCount(key: keyof BadgeCounts) {
  const { setCount } = useContext(BadgeContext);
  return useCallback((value: number) => setCount(key, value), [setCount, key]);
}
