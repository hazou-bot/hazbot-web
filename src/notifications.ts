import * as Notifications from 'expo-notifications';

import { AppSettings, Showing, ShowingSettings, UnitActivityType, User } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Prompts for permission the first time it's needed; silently no-ops after a denial. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`[${key}]`, value),
    template
  );
}

/** Combines a showing's "YYYY-MM-DD" date and "5:30 PM" time into a real Date. */
function showingDateTime(showing: Showing): Date | null {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(showing.time.trim());
  if (!m) return null;
  let hours = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hours += 12;
  const [year, month, day] = showing.date.split('-').map(Number);
  return new Date(year, month - 1, day, hours, Number(m[2]));
}

/**
 * Clears every scheduled reminder and re-schedules one per upcoming showing,
 * timed by ShowingSettings.reminderMinutes. Call this after showings or
 * showing-notification settings change — cheap and avoids per-id bookkeeping
 * since reminders are the only thing this app schedules.
 */
export async function rescheduleShowingReminders(
  showings: Showing[],
  appSettings: Pick<AppSettings, 'showingReminders' | 'reminderSentAlerts'>,
  showingSettings: Pick<ShowingSettings, 'reminderMinutes' | 'reminderTemplate'>,
  user: User | null
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!appSettings.showingReminders || !appSettings.reminderSentAlerts) return;
  if (!(await ensurePermission())) return;

  const now = Date.now();
  for (const s of showings) {
    const at = showingDateTime(s);
    if (!at) continue;
    const triggerDate = new Date(at.getTime() - showingSettings.reminderMinutes * 60_000);
    if (triggerDate.getTime() <= now) continue;

    // A client who explicitly asked to reschedule needs a distinct, more
    // direct nudge than a plain "hasn't confirmed" — they did respond, just
    // not with a yes, so the reminder shouldn't read as if nothing happened.
    if (s.status === 'reschedule_requested') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Reschedule requested — ${s.client}`,
          body: `${s.client} asked to reschedule the showing at ${s.time} for ${s.address}. Pick a new time before this slot arrives.`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
      continue;
    }

    // A client who never confirmed gets a "might need rescheduling" nudge
    // instead of the normal reminder — the agent should know before showing
    // up to an appointment nobody actually confirmed.
    if (s.status === 'no_answer') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `No confirmation — ${s.client}`,
          body: `${s.client} hasn't confirmed the showing at ${s.time} for ${s.address}. Consider rescheduling if you don't hear back.`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
      continue;
    }

    const body = fillTemplate(showingSettings.reminderTemplate, {
      name: s.client.split(' ')[0],
      agent: (user?.name ?? 'your agent').split(' ')[0],
      brokerage: user?.brokerage ?? 'Brooklyn Group',
      time: s.time,
      address: s.address,
    });

    await Notifications.scheduleNotificationAsync({
      content: { title: `Showing reminder — ${s.client}`, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
  }
}

/** Fires immediately — used right after an inbox scan finds new leads. */
export async function sendNewLeadNotification(
  count: number,
  appSettings: Pick<AppSettings, 'newLeadAlerts'>
): Promise<void> {
  if (!appSettings.newLeadAlerts || count === 0) return;
  if (!(await ensurePermission())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: count === 1 ? 'New lead' : `${count} new leads`,
      body:
        count === 1
          ? 'A new lead just came in — check the Leads tab.'
          : `${count} new leads just came in — check the Leads tab.`,
      sound: true,
    },
    trigger: null,
  });
}

/** Fires immediately — used right after an inbox scan finds a client reply. */
export async function sendLeadReplyNotification(
  leadNames: string[],
  appSettings: Pick<AppSettings, 'leadReplyAlerts'>
): Promise<void> {
  if (!appSettings.leadReplyAlerts || leadNames.length === 0) return;
  if (!(await ensurePermission())) return;

  const title =
    leadNames.length === 1 ? `${leadNames[0]} replied` : `${leadNames.length} leads replied`;
  const body =
    leadNames.length === 1
      ? `${leadNames[0]} responded to your message — check the Leads tab.`
      : `${leadNames.join(', ')} responded to your messages.`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/** Fires immediately — used right after a reply script actually goes out. */
export async function sendReplySentNotification(
  leadName: string,
  appSettings: Pick<AppSettings, 'replySentAlerts'>
): Promise<void> {
  if (!appSettings.replySentAlerts) return;
  if (!(await ensurePermission())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reply sent',
      body: `Your script was sent to ${leadName}.`,
      sound: true,
    },
    trigger: null,
  });
}

/** Fires immediately — used right after "Reply All" sends every outstanding lead's script at once. */
export async function sendReplyAllSentNotification(
  count: number,
  appSettings: Pick<AppSettings, 'replySentAlerts'>
): Promise<void> {
  if (!appSettings.replySentAlerts || count === 0) return;
  if (!(await ensurePermission())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'All replies sent',
      body: count === 1 ? 'Your script was sent to 1 lead.' : `Your script was sent to ${count} leads.`,
      sound: true,
    },
    trigger: null,
  });
}

/** Fires immediately — used right after an inventory sync finds a unit change. */
export async function sendUnitActivityNotification(
  activity: { type: UnitActivityType; unitLabel: string },
  appSettings: Pick<AppSettings, 'newUnitAlerts' | 'unitPendingAlerts' | 'unitClosedAlerts'>
): Promise<void> {
  const enabled =
    activity.type === 'new'
      ? appSettings.newUnitAlerts
      : activity.type === 'pending'
        ? appSettings.unitPendingAlerts
        : appSettings.unitClosedAlerts;
  if (!enabled) return;
  if (!(await ensurePermission())) return;

  const title =
    activity.type === 'new'
      ? 'New unit added'
      : activity.type === 'pending'
        ? 'Unit went pending'
        : 'Unit closed';
  const body =
    activity.type === 'new'
      ? `${activity.unitLabel} was added to your inventory.`
      : activity.type === 'pending'
        ? `${activity.unitLabel} just went pending.`
        : `${activity.unitLabel} closed — lease signed.`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}
