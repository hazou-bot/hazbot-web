/**
 * Web implementation of composeSms (see sms.ts for the native one and the
 * outcome contract). Browsers can't open a real SMS composer, so:
 *  - Phone browsers get an `sms:` link, which hands off to the device's
 *    messaging app with the body pre-filled (separator differs by OS —
 *    iOS wants `&body=`, Android wants `?body=`).
 *  - Desktop browsers copy the message to the clipboard instead, so the
 *    user can paste it into whatever they text from.
 */
export type SmsOutcome = 'sent' | 'cancelled' | 'copied' | 'unavailable';

function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIOSBrowser(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function composeSms(recipients: string[], message: string): Promise<SmsOutcome> {
  const target = recipients.map((r) => r.replace(/[^\d+]/g, '')).join(',');

  if (isMobileBrowser()) {
    const separator = isIOSBrowser() ? '&' : '?';
    const uri = message
      ? `sms:${target}${separator}body=${encodeURIComponent(message)}`
      : `sms:${target}`;
    window.location.href = uri;
    // The browser can't report whether the user actually sent — same
    // best-effort "counts as sent" call as Android's 'unknown' result.
    return 'sent';
  }

  if (message) {
    try {
      await navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}
