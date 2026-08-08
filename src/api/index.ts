/**
 * Hazbot API layer.
 *
 * Every screen reads data ONLY through this module. Right now it serves
 * local mock data with a small artificial delay; to hook up a real
 * backend, replace the bodies of these functions with fetch() calls and
 * nothing else in the app has to change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { leads } from '../data/leads';
import { showings } from '../data/showings';
import { unitNotifications } from '../data/unitNotifications';
import { units } from '../data/units';
import {
  AppSettings,
  DriveConnection,
  DriveSyncResult,
  EmailConnection,
  EmailProvider,
  InviteCode,
  Lead,
  LeadHistoryEntry,
  LeadReply,
  LeadSentMessage,
  NewShowingInput,
  OutgoingSettings,
  PlanId,
  ScanResult,
  SharedAccessModules,
  SharedAccessPerson,
  Showing,
  ShowingSettings,
  ShowingStatus,
  Unit,
  UnitNotification,
  UnitSearchFilters,
  UnitsSettings,
  User,
} from '../types';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lenient date parsing for the move-in filter. Accepts "MM-DD" (or "MM/DD"),
 * assuming the next occurrence of that date; falls back to full-date parsing.
 * Returns undefined if unparseable.
 */
function parseDate(input: string): Date | undefined {
  const trimmed = input.trim();
  const mmdd = /^(\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (mmdd) {
    const now = new Date();
    const candidate = new Date(now.getFullYear(), Number(mmdd[1]) - 1, Number(mmdd[2]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return Number.isNaN(candidate.getTime()) ? undefined : candidate;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// ── Auth ──────────────────────────────────────────────────────────

function nameFromEmail(email: string): string {
  const stem = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return stem
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Agent';
}

// TODO: replace with real API — POST /auth/login (returns JWT + user, including
// real subscription status from the backend/App Store server notifications)
export async function signIn(email: string, _password: string): Promise<User> {
  await delay(600);
  // Mock: any email/password combination signs in. Returning users are
  // treated as already subscribed so daily use never re-hits the paywall —
  // and as having already answered "how'd you hear about us" (a real
  // backend would have that on file from their original signup), so
  // /how-heard only ever appears for brand-new accounts via signUp().
  return {
    name: nameFromEmail(email),
    email: email.trim().toLowerCase(),
    brokerage: 'Brooklyn Group',
    subscribed: true,
    plan: 'pro',
    subscribedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    hearAboutSource: 'Returning user',
  };
}

// TODO: replace with real API — POST /auth/signup (returns JWT + user)
export async function signUp(name: string, email: string, _password: string): Promise<User> {
  await delay(600);
  // New accounts start unsubscribed — this is what routes them to /paywall.
  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    brokerage: 'Brooklyn Group',
    subscribed: false,
  };
}

// TODO: replace with real API — POST /auth/logout (invalidate token)
export async function signOut(): Promise<void> {
  await delay(150);
}

// TODO: replace with real StoreKit/RevenueCat purchase flow — this is where
// the App Store sheet appears and a real receipt gets validated server-side.
export async function subscribe(_plan: PlanId): Promise<void> {
  await delay(900);
}

// TODO: replace with real StoreKit/RevenueCat plan change (prorated swap).
export async function changePlan(_plan: PlanId): Promise<void> {
  await delay(600);
}

// TODO: replace with real StoreKit/RevenueCat cancellation — cancels at the
// end of the current billing period, no partial refund.
export async function cancelSubscription(): Promise<void> {
  await delay(600);
}

// TODO: replace with real StoreKit/RevenueCat call to undo a pending cancellation.
export async function resumeSubscription(): Promise<void> {
  await delay(600);
}

// ── Email connection (the V2 "connect your inbox" flow) ──────────

const EMAIL_CONN_KEY = 'hazbot.emailConnection';

// TODO: replace with real OAuth — expo-auth-session → Google/Microsoft consent
// screen → backend stores the refresh token and starts watching the inbox.
export async function connectEmail(
  provider: EmailProvider,
  address: string
): Promise<EmailConnection> {
  await delay(1600); // simulates the OAuth round-trip
  const conn: EmailConnection = {
    provider,
    address,
    connectedAt: new Date().toISOString(),
    lastScanAt: null,
  };
  await AsyncStorage.setItem(EMAIL_CONN_KEY, JSON.stringify(conn));
  return conn;
}

// TODO: replace with real API — GET /email/connection
export async function getEmailConnection(): Promise<EmailConnection | null> {
  const raw = await AsyncStorage.getItem(EMAIL_CONN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// TODO: replace with real API — DELETE /email/connection (revoke OAuth token)
export async function disconnectEmail(): Promise<void> {
  await delay(300);
  await AsyncStorage.removeItem(EMAIL_CONN_KEY);
}

// TODO: replace with real API — POST /email/scan (backend scans the inbox,
// parses StreetEasy/Zillow lead emails, returns import stats)
export async function scanInbox(): Promise<ScanResult> {
  await delay(2500); // simulates a real inbox sweep
  const raw = await AsyncStorage.getItem(EMAIL_CONN_KEY);
  if (raw) {
    const conn: EmailConnection = JSON.parse(raw);
    conn.lastScanAt = new Date().toISOString();
    await AsyncStorage.setItem(EMAIL_CONN_KEY, JSON.stringify(conn));
  }
  const newReplies = await simulateIncomingReplies();
  return { scannedEmails: 142, leadsImported: leads.length, newReplies };
}

// ── Drive connection (reads the agent's units/inventory workbook) ──

const DRIVE_CONN_KEY = 'hazbot.driveConnection';

// TODO: replace with real OAuth — expo-auth-session → Google consent screen
// (drive.readonly + spreadsheets.readonly scopes) → backend stores the
// refresh token and the picked file's ID, then polls/syncs its rows.
export async function connectDrive(
  fileName: string,
  accountEmail: string
): Promise<DriveConnection> {
  await delay(1600); // simulates the OAuth + file-picker round-trip
  const conn: DriveConnection = {
    fileName,
    accountEmail,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
  };
  await AsyncStorage.setItem(DRIVE_CONN_KEY, JSON.stringify(conn));
  return conn;
}

// TODO: replace with real API — GET /drive/connection
export async function getDriveConnection(): Promise<DriveConnection | null> {
  const raw = await AsyncStorage.getItem(DRIVE_CONN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// TODO: replace with real API — DELETE /drive/connection (revoke OAuth token)
export async function disconnectDrive(): Promise<void> {
  await delay(300);
  await AsyncStorage.removeItem(DRIVE_CONN_KEY);
}

// TODO: replace with real API — POST /drive/sync (backend re-reads the sheet,
// parses rows into Units, returns how many rows it picked up)
// TODO: this whole simulation goes away once sheet syncing is real — a real
// sync just diffs whatever rows actually changed. Here, each sync cycles
// through closing the oldest pending unit, then moving the oldest available
// unit to pending, then adding a brand-new unit — so testing each activity
// type doesn't require faking a real spreadsheet edit.
let unitSyncCycle = 0;

function unitLabel(u: Unit): string {
  return `${u.address} ${u.unit}`;
}

async function simulateUnitActivity(): Promise<DriveSyncResult['activity']> {
  const pending = units.filter((u) => u.status === 'pending');
  const available = units.filter((u) => u.status === 'available');

  const attempt = unitSyncCycle % 3;
  unitSyncCycle++;

  if (attempt === 0 && pending.length > 0) {
    const u = pending[0];
    u.status = 'taken';
    u.occupancy = 'Lease signed — closed';
    return { type: 'closed', unitLabel: unitLabel(u) };
  }
  if (attempt <= 1 && available.length > 0) {
    const u = available[0];
    u.status = 'pending';
    u.occupancy = 'Application in review — hold off on showings';
    return { type: 'pending', unitLabel: unitLabel(u) };
  }
  const template = units[0];
  const newUnit: Unit = {
    ...template,
    id: `unit-${Date.now()}`,
    unit: `#${units.length + 1}N`,
    status: 'available',
    concession: null,
    accessNotes: null,
    occupancy: 'Vacant — immediate',
    availableFrom: new Date().toISOString().slice(0, 10),
  };
  units.push(newUnit);
  return { type: 'new', unitLabel: unitLabel(newUnit) };
}

export async function syncDrive(): Promise<DriveSyncResult> {
  await delay(1800); // simulates a real sheet read
  const raw = await AsyncStorage.getItem(DRIVE_CONN_KEY);
  if (raw) {
    const conn: DriveConnection = JSON.parse(raw);
    conn.lastSyncAt = new Date().toISOString();
    await AsyncStorage.setItem(DRIVE_CONN_KEY, JSON.stringify(conn));
  }
  const activity = await simulateUnitActivity();
  return { rowsSynced: units.length, activity };
}

// ── Settings ──────────────────────────────────────────────────────

const SETTINGS_KEY = 'hazbot.settings';
const DEFAULT_SETTINGS: AppSettings = {
  newLeadAlerts: true,
  leadReplyAlerts: true,
  showingReminders: true,
  autoReplyLeads: false,
  autoReplyEnabledAt: null,
  autoReplyDelayMinutes: 0,
  leadHistoryRetentionDays: 7,
  reminderSentAlerts: true,
  replySentAlerts: true,
  newUnitAlerts: true,
  unitPendingAlerts: true,
  unitClosedAlerts: true,
  quietHoursEnabled: false,
  quietHoursStart: '10:00 PM',
  quietHoursEnd: '8:00 AM',
};

// In-memory cache + write queue: two screens (Leads header switch, Account's
// Settings card) both toggle the same keys, and a plain read-then-write
// AsyncStorage call can race — a slow-to-resolve earlier write can land
// after a later one and silently revert it. Serializing every read/write
// through this queue guarantees they apply in call order, and once the
// cache is warm, reads never round-trip to AsyncStorage at all.
let settingsCache: AppSettings | null = null;
let settingsQueue: Promise<unknown> = Promise.resolve();

function loadSettings(): Promise<unknown> {
  settingsQueue = settingsQueue.then(async () => {
    if (!settingsCache) {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      settingsCache = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    }
  });
  return settingsQueue;
}

// TODO: replace with real API — GET /settings
export async function getSettings(): Promise<AppSettings> {
  await loadSettings();
  return settingsCache!;
}

// TODO: replace with real API — PUT /settings
export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  await loadSettings();
  settingsQueue = settingsQueue.then(async () => {
    settingsCache = { ...settingsCache!, ...patch };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
  });
  await settingsQueue;
  return settingsCache!;
}

// TODO: replace with real API — PUT /profile
export async function updateProfile(user: User): Promise<User> {
  await delay(400);
  return user;
}

// TODO: replace with real API — POST /auth/change-password (verify
// currentPassword server-side before accepting newPassword)
export async function changePassword(
  _currentPassword: string,
  _newPassword: string
): Promise<void> {
  await delay(500);
}

// TODO: replace with real API — POST /account/export (backend emails a zip
// of leads, contacts, and showings within 24h; GDPR/CCPA-style data export)
export async function requestDataExport(): Promise<void> {
  await delay(500);
}

// TODO: replace with real API — DELETE /account (permanently deletes the
// user's account and all server-side data; revoke tokens, cancel subscription)
export async function deleteAccount(): Promise<void> {
  await delay(800);
}

// ── Showing settings ──────────────────────────────────────────────

const SHOWING_SETTINGS_KEY = 'hazbot.showingSettings';
export const DEFAULT_REMINDER_TEMPLATE =
  'Hi [name], this is [agent] from [brokerage] — reminder: your showing at [time] for [address]. Reply YES to confirm.';
const DEFAULT_SHOWING_SETTINGS: ShowingSettings = {
  autoReplies: false,
  reminderMinutes: 60,
  reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
  historyRetentionDays: 7,
};

// Same cache + write-queue pattern as settingsCache above, for the same
// reason: rapid taps (e.g. dragging the reminder slider) shouldn't be able
// to race and drop an update.
let showingSettingsCache: ShowingSettings | null = null;
let showingSettingsQueue: Promise<unknown> = Promise.resolve();

function loadShowingSettings(): Promise<unknown> {
  showingSettingsQueue = showingSettingsQueue.then(async () => {
    if (!showingSettingsCache) {
      const raw = await AsyncStorage.getItem(SHOWING_SETTINGS_KEY);
      showingSettingsCache = raw
        ? { ...DEFAULT_SHOWING_SETTINGS, ...JSON.parse(raw) }
        : DEFAULT_SHOWING_SETTINGS;
    }
  });
  return showingSettingsQueue;
}

// TODO: replace with real API — GET /showings/settings
export async function getShowingSettings(): Promise<ShowingSettings> {
  await loadShowingSettings();
  return showingSettingsCache!;
}

// TODO: replace with real API — PUT /showings/settings (backend acts on
// autoReplies + reminderMinutes by scheduling outbound reminder texts)
export async function updateShowingSettings(
  patch: Partial<ShowingSettings>
): Promise<ShowingSettings> {
  await loadShowingSettings();
  showingSettingsQueue = showingSettingsQueue.then(async () => {
    showingSettingsCache = { ...showingSettingsCache!, ...patch };
    await AsyncStorage.setItem(SHOWING_SETTINGS_KEY, JSON.stringify(showingSettingsCache));
  });
  await showingSettingsQueue;
  return showingSettingsCache!;
}

// TODO: replace with real integration — expo-calendar (Apple/Google) with
// permission prompt, or backend-generated .ics invites.
export async function addShowingsToCalendar(
  provider: 'apple' | 'google'
): Promise<{ added: number }> {
  await delay(1200);
  const today = new Date().toISOString().slice(0, 10);
  return { added: showings.filter((s) => s.date >= today).length };
}

// ── Contacts (derived from leads) ──────────────────────────────────

const REMOVED_CONTACTS_KEY = 'hazbot.removedContactIds';

async function getRemovedContactIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(REMOVED_CONTACTS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

const MANUAL_CONTACTS_KEY = 'hazbot.manualContacts';

async function getManualContacts(): Promise<Lead[]> {
  const raw = await AsyncStorage.getItem(MANUAL_CONTACTS_KEY);
  return raw ? (JSON.parse(raw) as Lead[]) : [];
}

function nowReceivedAtLabel(): string {
  const now = new Date();
  const hour24 = now.getHours();
  const hour = hour24 % 12 || 12;
  const minute = now.getMinutes().toString().padStart(2, '0');
  return `Today ${hour}:${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

// TODO: replace with real API — GET /contacts (backend-side CRM built from
// every parsed lead email, not just the in-memory mock list)
export async function getContacts(): Promise<Lead[]> {
  await delay();
  const [removed, deleted, manual] = await Promise.all([
    getRemovedContactIds(),
    getDeletedLeadIds(),
    getManualContacts(),
  ]);
  return [...manual, ...leads].filter((l) => !removed.has(l.id) && !deleted.has(l.id));
}

// TODO: replace with real API — POST /contacts (a client entered by hand,
// not parsed from an inbound lead email)
export async function addManualContact(input: {
  name: string;
  phone: string;
  email: string;
  listing: string;
}): Promise<Lead> {
  const contact: Lead = {
    id: `manual-${Date.now()}`,
    name: input.name,
    listing: input.listing,
    source: 'Manual',
    receivedAt: nowReceivedAtLabel(),
    summary: '',
    income: '',
    availability: '',
    email: input.email,
    phone: input.phone,
    emailBody: '',
  };
  const manual = await getManualContacts();
  manual.unshift(contact);
  await AsyncStorage.setItem(MANUAL_CONTACTS_KEY, JSON.stringify(manual));
  return contact;
}

// TODO: replace with real API — DELETE /contacts/:id (hides from Hazbot,
// does not touch the phone's own Contacts app)
export async function removeContact(id: string): Promise<void> {
  const removed = await getRemovedContactIds();
  removed.add(id);
  await AsyncStorage.setItem(REMOVED_CONTACTS_KEY, JSON.stringify([...removed]));
}

const FAVORITE_CONTACT_IDS_KEY = 'hazbot.favoriteContactIds';

// TODO: replace with real API — GET /contacts (favorite flag would come back inline)
export async function getFavoriteContactIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(FAVORITE_CONTACT_IDS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — PATCH /contacts/:id { favorite }. Returns the new state.
export async function toggleContactFavorite(id: string): Promise<boolean> {
  const favorites = await getFavoriteContactIds();
  const wasFavorite = favorites.has(id);
  if (wasFavorite) favorites.delete(id);
  else favorites.add(id);
  await AsyncStorage.setItem(FAVORITE_CONTACT_IDS_KEY, JSON.stringify([...favorites]));
  return !wasFavorite;
}

const CONTACT_NOTES_KEY = 'hazbot.contactNotes';

async function getContactNotesMap(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(CONTACT_NOTES_KEY);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

// TODO: replace with real API — GET /contacts/:id/note
export async function getContactNote(id: string): Promise<string> {
  const notes = await getContactNotesMap();
  return notes[id] ?? '';
}

// TODO: replace with real API — PUT /contacts/:id/note
export async function setContactNote(id: string, note: string): Promise<void> {
  const notes = await getContactNotesMap();
  const trimmed = note.trim();
  if (trimmed) notes[id] = trimmed;
  else delete notes[id];
  await AsyncStorage.setItem(CONTACT_NOTES_KEY, JSON.stringify(notes));
}

// ── Leads ─────────────────────────────────────────────────────────

const DELETED_LEADS_KEY = 'hazbot.deletedLeadIds';
const SKIPPED_LEADS_KEY = 'hazbot.skippedLeadIds';

async function getDeletedLeadIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(DELETED_LEADS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

async function getSkippedLeadIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SKIPPED_LEADS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — GET /leads (active only — excludes skipped/deleted)
export async function getLeads(): Promise<Lead[]> {
  await delay();
  const [deleted, skipped] = await Promise.all([getDeletedLeadIds(), getSkippedLeadIds()]);
  return leads.filter((l) => !deleted.has(l.id) && !skipped.has(l.id));
}

// TODO: replace with real API — GET /leads?skipped=true
export async function getSkippedLeads(): Promise<Lead[]> {
  await delay(200);
  const [deleted, skipped] = await Promise.all([getDeletedLeadIds(), getSkippedLeadIds()]);
  return leads.filter((l) => skipped.has(l.id) && !deleted.has(l.id));
}

// TODO: replace with real API — POST /leads/:id/skip
export async function skipLead(id: string): Promise<void> {
  const skipped = await getSkippedLeadIds();
  skipped.add(id);
  await AsyncStorage.setItem(SKIPPED_LEADS_KEY, JSON.stringify([...skipped]));
}

// TODO: replace with real API — POST /leads/:id/unskip (restores to active Leads)
export async function unskipLead(id: string): Promise<void> {
  const skipped = await getSkippedLeadIds();
  skipped.delete(id);
  await AsyncStorage.setItem(SKIPPED_LEADS_KEY, JSON.stringify([...skipped]));
}

// TODO: replace with real API — POST /leads/unskip-all (bulk restore)
export async function clearAllSkipped(): Promise<void> {
  await AsyncStorage.removeItem(SKIPPED_LEADS_KEY);
}

// TODO: replace with real API — GET /leads/:id
export async function getLead(id: string): Promise<Lead | undefined> {
  await delay(150);
  const deleted = await getDeletedLeadIds();
  if (deleted.has(id)) return undefined;
  return leads.find((l) => l.id === id);
}

// ── Lead reply script ────────────────────────────────────────────

const LEAD_SCRIPT_KEY = 'hazbot.leadReplyScript';
export const DEFAULT_LEAD_SCRIPT =
  'Hi [name], thanks for reaching out about [listing]! It\'s still available — I\'d love to set up a showing. What days/times work best for you this week?\n\n[agent]\n[brokerage]';

// TODO: replace with real API — GET /leads/reply-script
export async function getLeadReplyScript(): Promise<string> {
  const raw = await AsyncStorage.getItem(LEAD_SCRIPT_KEY);
  return raw ?? DEFAULT_LEAD_SCRIPT;
}

// TODO: replace with real API — PUT /leads/reply-script (this becomes the
// script hazbot sends verbatim when autoReplyLeads is on)
export async function updateLeadReplyScript(script: string): Promise<void> {
  await AsyncStorage.setItem(LEAD_SCRIPT_KEY, script);
}

// TODO: replace with real API — DELETE /leads/:id (permanent — also removes
// the lead's CRM/contact record, unlike Skip which just hides it in-session)
export async function deleteLead(id: string): Promise<void> {
  const deleted = await getDeletedLeadIds();
  deleted.add(id);
  await AsyncStorage.setItem(DELETED_LEADS_KEY, JSON.stringify([...deleted]));
}

// TODO: replace with real API — GET /units?maxPrice=&moveIn=&beds=&minBaths=&area=
export async function getUnits(filters: UnitSearchFilters = {}): Promise<Unit[]> {
  await delay();
  const { maxPrice, moveIn, beds, minBaths, area, status } = filters;
  const moveInDate = moveIn ? parseDate(moveIn) : undefined;
  const areaQuery = area?.trim().toLowerCase();

  return units.filter((u) => {
    if (status !== undefined && u.status !== status) return false;
    if (maxPrice !== undefined && u.netRent > maxPrice) return false;
    if (beds !== undefined) {
      // 3 means "3+"; otherwise exact match (0 = studio)
      if (beds >= 3 ? u.beds < 3 : u.beds !== beds) return false;
    }
    if (minBaths !== undefined && u.baths < minBaths) return false;
    if (
      areaQuery &&
      !u.neighborhood.toLowerCase().includes(areaQuery) &&
      !u.address.toLowerCase().includes(areaQuery)
    )
      return false;
    if (moveInDate && new Date(u.availableFrom) > moveInDate) return false;
    return true;
  });
}

// TODO: replace with real API — GET /units/:id
export async function getUnit(id: string): Promise<Unit | undefined> {
  await delay(150);
  return units.find((u) => u.id === id);
}

// ── Units tab settings ───────────────────────────────────────────

const UNITS_SETTINGS_KEY = 'hazbot.unitsSettings';
const DEFAULT_UNITS_SETTINGS: UnitsSettings = { visibility: 'all' };

// Same cache + write-queue pattern as settingsCache above.
let unitsSettingsCache: UnitsSettings | null = null;
let unitsSettingsQueue: Promise<unknown> = Promise.resolve();

function loadUnitsSettings(): Promise<unknown> {
  unitsSettingsQueue = unitsSettingsQueue.then(async () => {
    if (!unitsSettingsCache) {
      const raw = await AsyncStorage.getItem(UNITS_SETTINGS_KEY);
      unitsSettingsCache = raw
        ? { ...DEFAULT_UNITS_SETTINGS, ...JSON.parse(raw) }
        : DEFAULT_UNITS_SETTINGS;
    }
  });
  return unitsSettingsQueue;
}

// TODO: replace with real API — GET /units/settings
export async function getUnitsSettings(): Promise<UnitsSettings> {
  await loadUnitsSettings();
  return unitsSettingsCache!;
}

// TODO: replace with real API — PUT /units/settings
export async function updateUnitsSettings(
  patch: Partial<UnitsSettings>
): Promise<UnitsSettings> {
  await loadUnitsSettings();
  unitsSettingsQueue = unitsSettingsQueue.then(async () => {
    unitsSettingsCache = { ...unitsSettingsCache!, ...patch };
    await AsyncStorage.setItem(UNITS_SETTINGS_KEY, JSON.stringify(unitsSettingsCache));
  });
  await unitsSettingsQueue;
  return unitsSettingsCache!;
}

// ── Shared access ─────────────────────────────────────────────────
// A real implementation needs actual multi-user auth + an email invite
// (and the invitee accepting on their own device) before this grants real
// access — for now it's the data model + UI, stored locally.

const SHARED_ACCESS_KEY = 'hazbot.sharedAccess';

// TODO: replace with real API — GET /shared-access
export async function getSharedAccess(): Promise<SharedAccessPerson[]> {
  await delay();
  const raw = await AsyncStorage.getItem(SHARED_ACCESS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// TODO: replace with real API — POST /shared-access (sends the invitee an
// actual email/link to accept before they get real access)
export async function addSharedAccess(input: {
  name: string;
  email: string;
  phone?: string;
  modules: SharedAccessModules;
}): Promise<SharedAccessPerson> {
  await delay(400);
  const person: SharedAccessPerson = {
    id: `share-${Date.now()}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
    modules: input.modules,
    addedAt: new Date().toISOString(),
  };
  const list = await getSharedAccess();
  list.push(person);
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(list));
  return person;
}

// TODO: replace with real API — PATCH /shared-access/:id
export async function updateSharedAccess(
  id: string,
  modules: SharedAccessModules
): Promise<void> {
  const list = await getSharedAccess();
  const next = list.map((p) => (p.id === id ? { ...p, modules } : p));
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(next));
}

// TODO: replace with real API — DELETE /shared-access/:id
export async function removeSharedAccess(id: string): Promise<void> {
  const list = await getSharedAccess();
  await AsyncStorage.setItem(
    SHARED_ACCESS_KEY,
    JSON.stringify(list.filter((p) => p.id !== id))
  );
}

// A shared-access person can connect their own Gmail/workbook — same mock
// pattern as the signed-in user's own Data sources, just keyed by person id.
// TODO: replace with real API — POST /shared-access/:id/email (real Google
// OAuth, initiated from the invitee's own device once they accept the invite)
export async function connectPersonEmail(id: string, address: string): Promise<EmailConnection> {
  await delay(600);
  const conn: EmailConnection = {
    provider: 'gmail',
    address: address.trim().toLowerCase(),
    connectedAt: new Date().toISOString(),
    lastScanAt: null,
  };
  const list = await getSharedAccess();
  const next = list.map((p) => (p.id === id ? { ...p, emailConnection: conn } : p));
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(next));
  return conn;
}

// TODO: replace with real API — DELETE /shared-access/:id/email
export async function disconnectPersonEmail(id: string): Promise<void> {
  const list = await getSharedAccess();
  const next = list.map((p) => (p.id === id ? { ...p, emailConnection: undefined } : p));
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(next));
}

// TODO: replace with real API — POST /shared-access/:id/drive
export async function connectPersonDrive(
  id: string,
  fileName: string,
  accountEmail: string
): Promise<DriveConnection> {
  await delay(600);
  const conn: DriveConnection = {
    fileName: fileName.trim(),
    accountEmail: accountEmail.trim().toLowerCase(),
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
  };
  const list = await getSharedAccess();
  const next = list.map((p) => (p.id === id ? { ...p, driveConnection: conn } : p));
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(next));
  return conn;
}

// TODO: replace with real API — DELETE /shared-access/:id/drive
export async function disconnectPersonDrive(id: string): Promise<void> {
  const list = await getSharedAccess();
  const next = list.map((p) => (p.id === id ? { ...p, driveConnection: undefined } : p));
  await AsyncStorage.setItem(SHARED_ACCESS_KEY, JSON.stringify(next));
}

// ── Invite codes ─────────────────────────────────────────────────
// A code a teammate types in at signup/login instead of Harry filling out
// their info by hand. TODO: replace with real API — codes should be
// server-generated and validated against the actual workspace/seat count;
// this device has no backend, so "redeeming" a code just checks it against
// the same AsyncStorage the code was generated into (works fine for trying
// the flow on one device, doesn't prove real cross-device invites).

const INVITE_CODE_KEY = 'hazbot.inviteCode';
// Excludes 0/O/1/I/L — easy to read aloud or copy without mixing up characters.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
  return `${part()}-${part()}`;
}

/** Get-or-create — a workspace only ever has one active code at a time. */
export async function getInviteCode(ownerName: string): Promise<InviteCode> {
  const raw = await AsyncStorage.getItem(INVITE_CODE_KEY);
  if (raw) return JSON.parse(raw);
  const fresh: InviteCode = { code: generateCode(), ownerName, createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(INVITE_CODE_KEY, JSON.stringify(fresh));
  return fresh;
}

// TODO: replace with real API — POST /invite-code/regenerate (should also
// invalidate the old code server-side so it can't be redeemed after this)
export async function regenerateInviteCode(ownerName: string): Promise<InviteCode> {
  const fresh: InviteCode = { code: generateCode(), ownerName, createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(INVITE_CODE_KEY, JSON.stringify(fresh));
  return fresh;
}

// TODO: replace with real API — POST /invite-code/redeem (should also
// enforce the owner's seat cap server-side; can't check that locally here
// since this device has no concept of "the owner's plan" once they're
// signed out during a teammate's signup)
export async function redeemInviteCode(
  code: string,
  invitee: { name?: string; email: string }
): Promise<{ ok: true; ownerName: string } | { ok: false }> {
  await delay(500);
  const raw = await AsyncStorage.getItem(INVITE_CODE_KEY);
  const stored: InviteCode | null = raw ? JSON.parse(raw) : null;
  if (!stored || stored.code.toUpperCase() !== code.trim().toUpperCase()) {
    return { ok: false };
  }
  await addSharedAccess({
    name: invitee.name?.trim() || nameFromEmail(invitee.email),
    email: invitee.email,
    modules: { leads: false, units: false, showings: false, contacts: false },
  });
  return { ok: true, ownerName: stored.ownerName };
}

// ── Outgoing identity ────────────────────────────────────────────
// Which connected person's phone outgoing showing-reminder texts represent —
// only meaningful once 2+ people are connected via shared access. Email has
// no equivalent picker here — see the comment on OutgoingSettings.

const OUTGOING_SETTINGS_KEY = 'hazbot.outgoingSettings';
const DEFAULT_OUTGOING_SETTINGS: OutgoingSettings = {
  phoneIdentityId: 'me',
};

// TODO: replace with real API — GET /settings/outgoing
export async function getOutgoingSettings(): Promise<OutgoingSettings> {
  const raw = await AsyncStorage.getItem(OUTGOING_SETTINGS_KEY);
  return raw ? { ...DEFAULT_OUTGOING_SETTINGS, ...JSON.parse(raw) } : DEFAULT_OUTGOING_SETTINGS;
}

// TODO: replace with real API — PUT /settings/outgoing
export async function updateOutgoingSettings(
  patch: Partial<OutgoingSettings>
): Promise<OutgoingSettings> {
  const current = await getOutgoingSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(OUTGOING_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

// ── Unit status notifications ──────────────────────────────────────

const READ_UNIT_NOTIFICATIONS_KEY = 'hazbot.readUnitNotificationIds';

async function getReadNotificationIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(READ_UNIT_NOTIFICATIONS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — GET /units/notifications (server pushes one
// of these the moment a unit's status flips, ideally as a native push too)
export async function getUnitNotifications(): Promise<(UnitNotification & { read: boolean })[]> {
  await delay(200);
  const [readIds, dismissedIds] = await Promise.all([
    getReadNotificationIds(),
    getDismissedNotificationIds(),
  ]);
  return unitNotifications
    .filter((n) => !dismissedIds.has(n.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((n) => ({ ...n, read: readIds.has(n.id) }));
}

// TODO: replace with real API — POST /units/notifications/:id/read
export async function markNotificationRead(id: string): Promise<void> {
  const readIds = await getReadNotificationIds();
  readIds.add(id);
  await AsyncStorage.setItem(READ_UNIT_NOTIFICATIONS_KEY, JSON.stringify([...readIds]));
}

// TODO: replace with real API — POST /units/notifications/read-all
export async function markAllNotificationsRead(): Promise<void> {
  const allIds = unitNotifications.map((n) => n.id);
  await AsyncStorage.setItem(READ_UNIT_NOTIFICATIONS_KEY, JSON.stringify(allIds));
}

const DISMISSED_UNIT_NOTIFICATIONS_KEY = 'hazbot.dismissedUnitNotificationIds';

async function getDismissedNotificationIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(DISMISSED_UNIT_NOTIFICATIONS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — DELETE /units/notifications/:id (removes it
// from the agent's list; doesn't affect the unit's actual status)
export async function dismissNotification(id: string): Promise<void> {
  const dismissed = await getDismissedNotificationIds();
  dismissed.add(id);
  await AsyncStorage.setItem(DISMISSED_UNIT_NOTIFICATIONS_KEY, JSON.stringify([...dismissed]));
}

// ── Lead reply status (sent / waiting for response) ────────────────

// v2: an earlier bug permanently stamped every lead as "replied" the first
// time Auto reply was toggled on. Versioning the key abandons that bad data
// on every device instead of requiring a manual reset.
const LEAD_REPLY_STATE_KEY = 'hazbot.leadReplySentAt.v2';

// TODO: replace with real API — GET /leads/reply-status (per-lead sent-at
// timestamps from the backend's reply log; "waiting" is derived client-side
// or the backend can just say whether the client has responded since)
export async function getLeadReplyState(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(LEAD_REPLY_STATE_KEY);
  return raw ? JSON.parse(raw) : {};
}

// TODO: replace with real API — POST /leads/:id/reply (sends reply_script.txt
// verbatim, threaded onto the original lead email — same as hazbot's ✅ flow)
export async function markLeadReplied(id: string): Promise<void> {
  return markLeadsReplied([id]);
}

// "Reply All" sends several leads at once — each going through the single-id
// version concurrently would race (both read the same pre-write state, then
// whichever write lands last clobbers the other), silently dropping all but
// one id. Read once, stamp every id, write once instead — same fix already
// applied to markShowingsViewed.
// TODO: replace with real API — POST /leads/reply-all (batch)
export async function markLeadsReplied(ids: string[]): Promise<void> {
  const state = await getLeadReplyState();
  const now = new Date().toISOString();
  ids.forEach((id) => {
    state[id] = now;
  });
  await AsyncStorage.setItem(LEAD_REPLY_STATE_KEY, JSON.stringify(state));
}

// ── Client replies (the lead responding to our sent script) ────────

const LEAD_REPLIES_KEY = 'hazbot.leadReplies';

const CLIENT_REPLY_POOL = [
  "Yes that works! Can we do Thursday around 6pm?",
  "Thanks so much — is it still available? I'd love to see it this weekend.",
  "That time works for me, see you then!",
  "Quick question — is the rent at all negotiable?",
  "Perfect, I'll be there. Should I bring anything (ID, pay stubs)?",
  "Sorry for the slow reply — still very interested, what other times are open?",
  "Can we push to next week instead? This week got busy.",
  "Sounds great, thank you for the quick response!",
];

// TODO: replace with real API — GET /leads/replies (per-lead inbound reply
// text + timestamp, parsed from the threaded email the client wrote back)
export async function getLeadReplies(): Promise<Record<string, LeadReply>> {
  const raw = await AsyncStorage.getItem(LEAD_REPLIES_KEY);
  return raw ? JSON.parse(raw) : {};
}

// TODO: this whole simulation goes away once inbox scanning is real — a real
// scan just parses whatever threaded replies actually arrived. Here, each
// scan "discovers" a reply from the oldest lead that's been waiting longest
// and hasn't replied yet, so testing the flow doesn't require a real inbox.
async function simulateIncomingReplies(): Promise<{ id: string; name: string }[]> {
  const [replyState, replies] = await Promise.all([getLeadReplyState(), getLeadReplies()]);
  const oldestWaitingId = Object.entries(replyState)
    .filter(([id]) => !replies[id])
    .sort((a, b) => (a[1] < b[1] ? -1 : 1))[0]?.[0];
  if (!oldestWaitingId) return [];

  const lead = leads.find((l) => l.id === oldestWaitingId);
  if (!lead) return [];

  replies[oldestWaitingId] = {
    body: CLIENT_REPLY_POOL[Math.floor(Math.random() * CLIENT_REPLY_POOL.length)],
    receivedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LEAD_REPLIES_KEY, JSON.stringify(replies));
  return [{ id: lead.id, name: lead.name }];
}

// ── Lead history (sent messages + thread) ───────────────────────────

const LEAD_SENT_MESSAGES_KEY = 'hazbot.leadSentMessages';

async function getAllLeadSentMessages(): Promise<Record<string, LeadSentMessage[]>> {
  const raw = await AsyncStorage.getItem(LEAD_SENT_MESSAGES_KEY);
  return raw ? JSON.parse(raw) : {};
}

// TODO: replace with real API — POST /leads/:id/reply persists the actual
// sent body server-side (threaded onto the email), not just a sent-at stamp.
// Also re-stamps the existing reply-state timestamp so "Reply sent" /
// "Waiting for response" on the Leads tab stays in sync with this.
export async function recordLeadSentMessage(
  id: string,
  body: string,
  identityId: string
): Promise<void> {
  return recordLeadSentMessages([{ id, body, identityId }]);
}

// Reply All sends to many leads at once, each from a potentially different
// identity (whichever inbox received that specific lead) — batched into one
// read-modify-write for the same race-avoidance reason as markLeadsReplied.
export async function recordLeadSentMessages(
  entries: { id: string; body: string; identityId: string }[]
): Promise<void> {
  const all = await getAllLeadSentMessages();
  const now = new Date().toISOString();
  entries.forEach(({ id, body, identityId }) => {
    all[id] = [...(all[id] ?? []), { body, sentAt: now, identityId }];
  });
  await AsyncStorage.setItem(LEAD_SENT_MESSAGES_KEY, JSON.stringify(all));
  await markLeadsReplied(entries.map((e) => e.id));
}

// TODO: replace with real API — GET /leads/:id/messages
export async function getLeadSentMessages(id: string): Promise<LeadSentMessage[]> {
  const all = await getAllLeadSentMessages();
  return all[id] ?? [];
}

// TODO: replace with real API — DELETE /leads/:id/history (clears this
// lead's sent-message thread only — the lead itself, and any client reply
// on file, are untouched, unlike deleteLead which removes the whole lead).
export async function clearLeadHistory(id: string): Promise<void> {
  const all = await getAllLeadSentMessages();
  delete all[id];
  await AsyncStorage.setItem(LEAD_SENT_MESSAGES_KEY, JSON.stringify(all));
}

// TODO: replace with real API — DELETE /leads/history (clears every lead's
// sent-message thread — the leads themselves, and any client replies on
// file, are untouched, same scope as clearLeadHistory just applied to all).
export async function clearAllLeadHistory(): Promise<void> {
  await AsyncStorage.removeItem(LEAD_SENT_MESSAGES_KEY);
}

// TODO: replace with real API — GET /leads/history?days= (backend-side
// retention filter instead of fetching everything and trimming client-side)
export async function getLeadHistory(): Promise<LeadHistoryEntry[]> {
  await delay();
  const [all, deleted, settings] = await Promise.all([
    getAllLeadSentMessages(),
    getDeletedLeadIds(),
    getSettings(),
  ]);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.leadHistoryRetentionDays);

  return Object.entries(all)
    .filter(([id]) => !deleted.has(id))
    .map(([id, messages]) => {
      const lead = leads.find((l) => l.id === id);
      const lastSentAt = messages[messages.length - 1]?.sentAt;
      return lead && lastSentAt ? { lead, messages, lastSentAt } : null;
    })
    .filter((entry): entry is LeadHistoryEntry => entry !== null && new Date(entry.lastSentAt) >= cutoff)
    .sort((a, b) => (a.lastSentAt < b.lastSentAt ? 1 : -1));
}

const CUSTOM_SHOWINGS_KEY = 'hazbot.customShowings';
const SHOWING_RESCHEDULES_KEY = 'hazbot.showingReschedules';
const DELETED_SHOWINGS_KEY = 'hazbot.deletedShowingIds';
const SHOWING_STATUS_OVERRIDE_KEY = 'hazbot.showingStatusOverride';

async function getDeletedShowingIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(DELETED_SHOWINGS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

/** "5:30 PM" → minutes since midnight, for within-day sorting. */
function timeToMinutes(time: string): number {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(time.trim());
  if (!m) return 0;
  let hours = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(m[2]);
}

async function getShowingReschedules(): Promise<Record<string, { date: string; time: string }>> {
  const raw = await AsyncStorage.getItem(SHOWING_RESCHEDULES_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function getShowingStatusOverrides(): Promise<Record<string, ShowingStatus>> {
  const raw = await AsyncStorage.getItem(SHOWING_STATUS_OVERRIDE_KEY);
  return raw ? JSON.parse(raw) : {};
}

// Shared base for every showings read — applies deletions, reschedules, and
// status overrides (cancel / simulated-reply outcomes) on top of the seed +
// custom-added showings. getShowings() and getShowingHistory() both start
// here and then apply their own, different date/status filter on top.
async function getAllMergedShowings(): Promise<Showing[]> {
  const raw = await AsyncStorage.getItem(CUSTOM_SHOWINGS_KEY);
  const custom: Showing[] = raw ? JSON.parse(raw) : [];
  const [reschedules, deleted, statusOverrides] = await Promise.all([
    getShowingReschedules(),
    getDeletedShowingIds(),
    getShowingStatusOverrides(),
  ]);
  return [...showings, ...custom]
    .filter((s) => !deleted.has(s.id))
    .map((s) => {
      const r = reschedules[s.id];
      const withReschedule = r ? { ...s, date: r.date, time: r.time } : s;
      const statusOverride = statusOverrides[s.id];
      return statusOverride ? { ...withReschedule, status: statusOverride } : withReschedule;
    });
}

// TODO: replace with real API — GET /showings (pass includePast to also fetch
// already-happened showings; use GET /showings/history for the dedicated
// History screen instead, which also folds in cancelled showings)
export async function getShowings(opts: { includePast?: boolean } = {}): Promise<Showing[]> {
  await delay();
  const merged = await getAllMergedShowings();
  const today = new Date().toISOString().slice(0, 10);
  // Cancelled showings never belong on the live agenda, even one scheduled
  // for later today — cancelling is what moves it into History, regardless
  // of includePast (showings-calendar.tsx uses includePast for its month
  // view and shouldn't show a cancelled dot either).
  return merged
    .filter((s) => (opts.includePast || s.date >= today) && s.status !== 'cancelled')
    .sort((a, b) =>
      a.date === b.date ? timeToMinutes(a.time) - timeToMinutes(b.time) : a.date < b.date ? -1 : 1
    );
}

// A showing counts as "history" once it's cancelled (any date) or its
// original date has passed — sorted most-recent-first, the opposite of the
// live agenda, and trimmed to ShowingSettings.historyRetentionDays. The
// retention window is applied here at read time rather than by deleting old
// records, so raising the setting later reveals more of what's already
// there instead of the data being gone for good.
// TODO: replace with real API — GET /showings/history?days=N
export async function getShowingHistory(): Promise<Showing[]> {
  await delay();
  const [merged, settings] = await Promise.all([getAllMergedShowings(), getShowingSettings()]);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.historyRetentionDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return merged
    .filter((s) => (s.status === 'cancelled' || s.date < today) && s.date >= cutoffIso)
    .sort((a, b) =>
      a.date === b.date ? timeToMinutes(b.time) - timeToMinutes(a.time) : a.date < b.date ? 1 : -1
    );
}

// TODO: replace with real API — DELETE /showings/:id
export async function deleteShowing(id: string): Promise<void> {
  const deleted = await getDeletedShowingIds();
  deleted.add(id);
  await AsyncStorage.setItem(DELETED_SHOWINGS_KEY, JSON.stringify([...deleted]));
}

// TODO: replace with real API — POST /showings/:id/cancel
export async function cancelShowing(id: string): Promise<void> {
  const overrides = await getShowingStatusOverrides();
  overrides[id] = 'cancelled';
  await AsyncStorage.setItem(SHOWING_STATUS_OVERRIDE_KEY, JSON.stringify(overrides));
}

// TODO: replace with real API — PATCH /showings/:id
export async function rescheduleShowing(id: string, date: string, time: string): Promise<void> {
  const parsed = parseDate(date);
  const iso = (parsed ?? new Date()).toISOString().slice(0, 10);
  const reschedules = await getShowingReschedules();
  reschedules[id] = { date: iso, time: time.trim() };
  await AsyncStorage.setItem(SHOWING_RESCHEDULES_KEY, JSON.stringify(reschedules));
}

// TODO: this whole simulation goes away once inbound SMS replies are real —
// today "Confirm via iMessage" just opens the native composer with no way to
// know how the client actually answered, so for testing this randomly picks
// one of the three real-world outcomes and applies it, the same way
// simulateIncomingReplies() fakes a lead responding.
const SHOWING_REPLY_OUTCOMES: ShowingStatus[] = ['confirmed', 'no_answer', 'reschedule_requested'];

export async function simulateShowingReply(id: string): Promise<ShowingStatus> {
  const outcome =
    SHOWING_REPLY_OUTCOMES[Math.floor(Math.random() * SHOWING_REPLY_OUTCOMES.length)];
  const overrides = await getShowingStatusOverrides();
  overrides[id] = outcome;
  await AsyncStorage.setItem(SHOWING_STATUS_OVERRIDE_KEY, JSON.stringify(overrides));
  return outcome;
}

// TODO: replace with real API — POST /showings
export async function addShowing(input: NewShowingInput): Promise<Showing> {
  await delay(300);
  const parsed = parseDate(input.date);
  const iso = (parsed ?? new Date()).toISOString().slice(0, 10);
  const showing: Showing = {
    id: `custom-${Date.now()}`,
    date: iso,
    time: input.time.trim(),
    address: input.address.trim(),
    client: input.client.trim(),
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim() || undefined,
    status: 'confirmed',
  };
  const raw = await AsyncStorage.getItem(CUSTOM_SHOWINGS_KEY);
  const custom: Showing[] = raw ? JSON.parse(raw) : [];
  custom.push(showing);
  await AsyncStorage.setItem(CUSTOM_SHOWINGS_KEY, JSON.stringify(custom));
  return showing;
}

// ── Showing SMS sent-tracking ───────────────────────────────────────

const SHOWING_SMS_SENT_KEY = 'hazbot.showingSmsSentAt';

// TODO: replace with real API — GET /showings/sms-status (backend logs the
// actual carrier delivery event instead of relying on the composer result)
export async function getShowingSmsSentState(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(SHOWING_SMS_SENT_KEY);
  return raw ? JSON.parse(raw) : {};
}

// TODO: replace with real API — POST /showings/:id/sms-sent
export async function markShowingSmsSent(id: string): Promise<void> {
  const state = await getShowingSmsSentState();
  state[id] = new Date().toISOString();
  await AsyncStorage.setItem(SHOWING_SMS_SENT_KEY, JSON.stringify(state));
}

// ── Showing completion tracking ─────────────────────────────────────

const SHOWING_COMPLETED_KEY = 'hazbot.showingCompletedAt';

// TODO: replace with real API — GET /showings/completed-status
export async function getShowingCompletedState(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(SHOWING_COMPLETED_KEY);
  return raw ? JSON.parse(raw) : {};
}

// TODO: replace with real API — POST /showings/:id/completed
export async function setShowingCompleted(id: string, completed: boolean): Promise<void> {
  const state = await getShowingCompletedState();
  if (completed) {
    state[id] = new Date().toISOString();
  } else {
    delete state[id];
  }
  await AsyncStorage.setItem(SHOWING_COMPLETED_KEY, JSON.stringify(state));
}

// ── Tab bar notification dots (Leads/Showings "viewed" tracking) ────
//
// Units already has a real read/unread notification feed (above). Leads and
// Showings don't have an equivalent event stream, so a lead or showing
// counts as "unseen" — and keeps the tab bar dot lit — until its own detail
// view has actually been opened at least once. Skipping/replying/rescheduling
// etc. all imply the item was seen too, but opening detail is the one gesture
// every path runs through, so it's the single source of truth.

const VIEWED_LEADS_KEY = 'hazbot.viewedLeadIds';

async function getViewedLeadIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(VIEWED_LEADS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — POST /leads/:id/viewed
export async function markLeadViewed(id: string): Promise<void> {
  const viewed = await getViewedLeadIds();
  if (viewed.has(id)) return;
  viewed.add(id);
  await AsyncStorage.setItem(VIEWED_LEADS_KEY, JSON.stringify([...viewed]));
}

// TODO: replace with real API — GET /leads/unseen-count
export async function getUnseenLeadCount(): Promise<number> {
  const [active, viewed] = await Promise.all([getLeads(), getViewedLeadIds()]);
  return active.filter((l) => !viewed.has(l.id)).length;
}

const VIEWED_SHOWINGS_KEY = 'hazbot.viewedShowingIds';

async function getViewedShowingIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(VIEWED_SHOWINGS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

// TODO: replace with real API — POST /showings/:id/viewed
export async function markShowingViewed(id: string): Promise<void> {
  return markShowingsViewed([id]);
}

// A merged multi-attendee slot marks several showings viewed at once — each
// going through the single-id version concurrently would race (both read
// the same pre-write state, then whichever write lands last clobbers the
// other), silently dropping all but one id. Read once, add every id, write
// once instead.
// TODO: replace with real API — POST /showings/viewed (batch)
export async function markShowingsViewed(ids: string[]): Promise<void> {
  const viewed = await getViewedShowingIds();
  ids.forEach((id) => viewed.add(id));
  await AsyncStorage.setItem(VIEWED_SHOWINGS_KEY, JSON.stringify([...viewed]));
}

// TODO: replace with real API — GET /showings/unseen-count
export async function getUnseenShowingCount(): Promise<number> {
  const [active, viewed] = await Promise.all([getShowings(), getViewedShowingIds()]);
  return active.filter((s) => !viewed.has(s.id)).length;
}
