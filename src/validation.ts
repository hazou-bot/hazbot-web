const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** US phone number — 10 digits, or 11 with a leading "1" country code. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Formats digits as the user types: "800-123-4567", or "1-800-123-4567" when
 * they lead with the "1" country code — distinguished by the first digit,
 * since no real NANP area code starts with 1.
 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('1')) {
    const rest = digits.slice(1, 11);
    if (rest.length <= 3) return rest ? `1-${rest}` : '1';
    if (rest.length <= 6) return `1-${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `1-${rest.slice(0, 3)}-${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
  }
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/**
 * Capitalizes the first letter of each word as the user types — "peter" ->
 * "Peter", "mary jane" -> "Mary Jane". Only forces the letter right after
 * the start of the string or a space; leaves every other character as typed
 * so it doesn't fight names with internal capitals (e.g. "McDonald").
 * `autoCapitalize="words"` is supposed to cover this natively, but browsers
 * largely ignore that hint on a plain desktop keyboard, so this makes it
 * work the same everywhere instead of only on some mobile keyboards.
 */
export function capitalizeWords(raw: string): string {
  return raw.replace(/(^|\s)([a-z])/g, (_match, boundary, letter) => boundary + letter.toUpperCase());
}

/**
 * Read-only display format for a phone number, e.g. the "+16465550221" the
 * mock data stores — always "(646)-555-0221" regardless of whether the
 * source had a country code, dashes, or nothing at all. Always formats
 * against the last 10 digits, so an international number (a leading "44",
 * etc.) still renders in the same "(XXX)-XXX-XXXX" shape instead of falling
 * back to whatever raw string was stored. Falls back to the original string
 * only when there aren't even 10 digits to work with (unexpected formats,
 * partial input) rather than mangling it.
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;
  const d = digits.slice(-10);
  return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6)}`;
}
