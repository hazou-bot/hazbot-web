import * as SMS from 'expo-sms';

/**
 * One shared "compose a text" entry point for every SMS feature in the app,
 * with a platform split: this native file wraps the expo-sms composer; the
 * sms.web.ts sibling implements the closest web equivalent (sms: links on
 * phone browsers, copy-to-clipboard on desktop). Callers branch on the
 * outcome instead of talking to expo-sms directly, so the web fallback is
 * automatic everywhere.
 */
export type SmsOutcome =
  | 'sent' // composer opened and the user sent (or the platform can't confirm — counted as sent)
  | 'cancelled' // user backed out of the composer without sending
  | 'copied' // web desktop only: no SMS app — message copied to the clipboard instead
  | 'unavailable'; // no composer and nothing worth copying

export async function composeSms(recipients: string[], message: string): Promise<SmsOutcome> {
  const available = await SMS.isAvailableAsync();
  if (!available) return 'unavailable';
  const { result } = await SMS.sendSMSAsync(recipients, message);
  // iOS reports 'sent'; Android/others report 'unknown' because they can't
  // confirm — treat those as sent rather than under-count.
  return result === 'cancelled' ? 'cancelled' : 'sent';
}
