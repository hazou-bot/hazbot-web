import { User } from '../types';

type PendingAuthRoute = '/welcome' | '/how-heard' | '/paywall';

/**
 * Where a signed-in user should land next in the auth/onboarding funnel, or
 * null once they're fully onboarded and can enter the tabs. Centralized here
 * because signup.tsx, login.tsx, and (tabs)/_layout.tsx all need the exact
 * same ordering — duplicating this as three separate ternaries is how one of
 * them silently drifts out of sync when a new gate (like /how-heard) is added.
 */
export function pendingAuthRoute(user: User | null): PendingAuthRoute | null {
  if (!user) return '/welcome';
  if (!user.hearAboutSource) return '/how-heard';
  if (!user.subscribed) return '/paywall';
  return null;
}
