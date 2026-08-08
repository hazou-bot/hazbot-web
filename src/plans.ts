import { PlanId } from './types';

/**
 * Single source of truth for subscription tiers — paywall.tsx, subscription.tsx,
 * shared-access-settings.tsx, and account.tsx all read from here so the price/
 * seat-cap story can never drift between screens.
 */

export const TRIAL_DAYS = 3;

export interface PlanDef {
  id: PlanId;
  label: string;
  price: string;
  priceValue: number;
  /** Total people who can use the account, including the owner. */
  maxSeats: number;
  tagline: string;
  features: string[];
  badge?: string;
}

export const PLANS: PlanDef[] = [
  {
    id: 'basic',
    label: 'Basic',
    price: '$14.99/mo',
    priceValue: 14.99,
    maxSeats: 1,
    tagline: 'Just you',
    features: ['Full access to Leads, Units, Showings & Contacts', 'No shared access for a teammate'],
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$24.99/mo',
    priceValue: 24.99,
    maxSeats: 2,
    tagline: 'You + 1 teammate',
    features: ['Everything in Basic', 'Invite exactly one teammate'],
    badge: 'Most popular',
  },
  {
    id: 'premium',
    label: 'Premium',
    price: '$29.99/mo',
    priceValue: 29.99,
    maxSeats: 5,
    tagline: 'You + up to 4 teammates',
    features: ['Everything in Pro', 'Invite up to 4 teammates (5 people total)'],
  },
];

export function getPlan(id: PlanId | undefined): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
