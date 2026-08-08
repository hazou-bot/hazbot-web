import { AppSettings, Showing, ShowingSettings, UnitActivityType, User } from './types';

// expo-notifications' web build pulls in a broken sub-dependency (badgin)
// that fails to resolve under Metro. This app only ships iOS builds, so
// notifications are a no-op on web — this file's existence is what makes
// Metro pick this stub over notifications.ts when bundling for the browser
// preview, avoiding the real native module (and badgin) entirely.

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function rescheduleShowingReminders(
  _showings: Showing[],
  _appSettings: Pick<AppSettings, 'showingReminders' | 'reminderSentAlerts'>,
  _showingSettings: Pick<ShowingSettings, 'reminderMinutes' | 'reminderTemplate'>,
  _user: User | null
): Promise<void> {}

export async function sendNewLeadNotification(
  _count: number,
  _appSettings: Pick<AppSettings, 'newLeadAlerts'>
): Promise<void> {}

export async function sendLeadReplyNotification(
  _leadNames: string[],
  _appSettings: Pick<AppSettings, 'leadReplyAlerts'>
): Promise<void> {}

export async function sendReplySentNotification(
  _leadName: string,
  _appSettings: Pick<AppSettings, 'replySentAlerts'>
): Promise<void> {}

export async function sendUnitActivityNotification(
  _activity: { type: UnitActivityType; unitLabel: string },
  _appSettings: Pick<AppSettings, 'newUnitAlerts' | 'unitPendingAlerts' | 'unitClosedAlerts'>
): Promise<void> {}
