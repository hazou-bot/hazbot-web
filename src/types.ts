export type PlanId = 'basic' | 'pro' | 'premium';

export interface User {
  name: string;
  email: string;
  brokerage: string;
  subscribed: boolean; // has an active (mock) subscription — gates the app behind /paywall
  plan?: PlanId;
  subscribedAt?: string; // ISO — when the trial/subscription started
  cancelAtPeriodEnd?: boolean; // canceled but still active until the current period ends
  joinedViaInvite?: boolean; // signed up/in with a teammate's invite code — riding their plan's seat
  hearAboutSource?: string; // acquisition-analytics answer from /how-heard — gates that screen once set
}

export const HEAR_ABOUT_OPTIONS = [
  'App Store search',
  'Google search',
  'Social media (Instagram/Facebook/TikTok)',
  'A colleague or friend',
  'Real estate conference/event',
  'Other',
] as const;

/** One code per workspace — shared via text/email/copy, redeemed at signup or login. */
export interface InviteCode {
  code: string;
  ownerName: string;
  createdAt: string;
}

export type EmailProvider = 'gmail' | 'outlook';

export interface EmailConnection {
  provider: EmailProvider;
  address: string;
  connectedAt: string; // ISO timestamp
  lastScanAt: string | null; // ISO timestamp of most recent inbox scan
}

export interface DriveConnection {
  fileName: string; // the connected spreadsheet's display name
  accountEmail: string; // the Google account it's connected as
  connectedAt: string; // ISO timestamp
  lastSyncAt: string | null; // ISO timestamp of most recent sync
}

export type UnitActivityType = 'new' | 'pending' | 'closed';

export interface DriveSyncResult {
  rowsSynced: number;
  activity: { type: UnitActivityType; unitLabel: string } | null;
}

export interface ScanResult {
  scannedEmails: number;
  leadsImported: number;
  newReplies: { id: string; name: string }[]; // leads who replied since the last scan
}

export interface LeadReply {
  body: string;
  receivedAt: string; // ISO timestamp
}

/** One outbound message (script or custom) actually sent to a lead. */
export interface LeadSentMessage {
  body: string;
  sentAt: string; // ISO timestamp
  identityId: string; // Identity.id ('me' or a SharedAccessPerson.id) — whose inbox sent it
}

/** A lead with at least one sent message, surfaced on the Lead history screen. */
export interface LeadHistoryEntry {
  lead: Lead;
  messages: LeadSentMessage[]; // sent messages, chronological
  lastSentAt: string; // ISO timestamp of the most recent sent message
}

export interface AppSettings {
  newLeadAlerts: boolean; // push when a new lead email arrives
  leadReplyAlerts: boolean; // push when a client replies to a message you sent
  showingReminders: boolean; // remind before each showing
  autoReplyLeads: boolean; // auto-send the reply script to new leads (mirrors hazbot's Discord "auto on/off")
  autoReplyEnabledAt: string | null; // ISO timestamp of when autoReplyLeads was last turned on
  autoReplyDelayMinutes: number; // how long after a lead comes in before the script auto-sends (0 = instant)
  leadHistoryRetentionDays: number; // how many days of sent-lead history the Lead history screen keeps (1–7)
  reminderSentAlerts: boolean; // notify when a showing reminder text actually goes out
  replySentAlerts: boolean; // notify when a lead reply script actually goes out
  newUnitAlerts: boolean; // notify when a new unit shows up in the inventory workbook
  unitPendingAlerts: boolean; // notify when a unit goes pending
  unitClosedAlerts: boolean; // notify when a unit closes (lease signed, final)
  quietHoursEnabled: boolean; // mute non-urgent pushes overnight
  quietHoursStart: string; // e.g. "10:00 PM"
  quietHoursEnd: string; // e.g. "8:00 AM"
}

export interface ShowingSettings {
  autoReplies: boolean; // backend auto-sends confirmation/reminder texts
  reminderMinutes: number; // how long before the showing to remind (5–360)
  reminderTemplate: string; // supports [name] [agent] [brokerage] [time] [address]
  historyRetentionDays: number; // how many days of past/cancelled showings the History screen keeps (1–7)
}

export type LeadSource = 'StreetEasy' | 'Zillow' | 'Manual';

export interface Lead {
  id: string;
  name: string;
  listing: string; // address the lead asked about
  source: LeadSource;
  receivedAt: string; // e.g. "Today 9:41 AM"
  summary: string; // one-line gist of the inquiry
  income: string; // e.g. "~$145k combined"
  credit?: string; // e.g. "740+" — omitted when the lead didn't state an actual credit rating (guarantor mentions etc. don't count)
  availability: string; // e.g. "Free weekday evenings, wants Sep 1"
  email: string;
  phone: string;
  emailBody: string; // full original email text
  receivedByEmail?: string; // which connected inbox this arrived in — replies always send from here (see resolveLeadIdentity), never a manually-picked identity, so the client only ever sees one sender. Undefined = the signed-in user's own inbox.
}

export type UnitStatus = 'available' | 'pending' | 'taken';

export interface Unit {
  id: string;
  building: string;
  address: string;
  neighborhood: string; // e.g. "Williamsburg" — used by the area filter
  unit: string;
  status: UnitStatus;
  grossRent: number; // monthly, advertised
  netRent: number; // net effective after concessions
  concession: string | null; // e.g. "1 month free on a 13-month lease"
  beds: number; // 0 = studio
  baths: number;
  availableFrom: string; // ISO date, earliest move-in
  occupancy: string; // e.g. "Vacant — immediate" or "Tenant in place until Aug 31"
  accessNotes: string | null; // lockbox/keypad codes, doorman instructions, etc.
  streetEasyUrl: string;
  // Current tenant's contact info, when a unit is occupied and this is on
  // file — absent for vacant units or when the landlord hasn't shared it.
  tenantName?: string;
  tenantPhone?: string;
}

export type ShowingStatus = 'confirmed' | 'no_answer' | 'reschedule_requested' | 'cancelled';

export interface Showing {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  time: string; // display time, e.g. "5:30 PM"
  address: string;
  client: string;
  phone: string;
  email?: string;
  status: ShowingStatus;
  unitId?: string; // the unit being shown — absent on manually scheduled showings
}

export interface NewShowingInput {
  date: string; // "MM-DD" (or full date)
  time: string; // e.g. "5:30 PM"
  client: string;
  address: string;
  phone?: string;
  email?: string;
}

export type UnitNotificationType = 'pending' | 'taken';

export interface UnitNotification {
  id: string;
  unitId: string;
  type: UnitNotificationType;
  message: string;
  createdAt: string; // ISO timestamp
}

export interface UnitSearchFilters {
  maxPrice?: number; // filter on net effective rent
  moveIn?: string; // "MM-DD" (or full date); units available by this date
  beds?: number; // 0 = studio, 3 = 3+
  minBaths?: number; // e.g. 1.5 means 1.5 baths or more
  area?: string; // matches neighborhood or address, case-insensitive
  status?: UnitStatus; // omit for all statuses
}

export type UnitVisibility = 'all' | UnitStatus;

export interface UnitsSettings {
  visibility: UnitVisibility; // which units show on the Units tab by default
}

/** Which parts of the app a shared-access person can view and edit. */
export interface SharedAccessModules {
  leads: boolean;
  units: boolean;
  showings: boolean;
  contacts: boolean;
}

export interface SharedAccessPerson {
  id: string;
  name: string;
  email: string;
  phone?: string; // needed to appear as a "send reminders from" identity option
  modules: SharedAccessModules;
  addedAt: string; // ISO timestamp
  emailConnection?: EmailConnection; // their own connected Gmail, once they set it up
  driveConnection?: DriveConnection; // their own connected workbook
}

/**
 * Which connected identity outgoing messages use — 'me' is the signed-in
 * user; any other value is a SharedAccessPerson.id. Only meaningful (and
 * only shown in the UI) once 2+ people are connected.
 *
 * Lead email replies are deliberately NOT configurable here — who sends a
 * lead reply is always whoever's inbox received that specific lead
 * (`Lead.receivedByEmail`), resolved automatically via
 * `resolveLeadIdentity()` in `identities.ts`. A manual global picker would
 * let a reply go out from a different address than the client originally
 * emailed, which is exactly the confusing-client scenario this is meant to
 * prevent.
 */
export interface OutgoingSettings {
  phoneIdentityId: string; // whose number the showing-reminder texts represent
}
