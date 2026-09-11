# AgentEasy Web — Known Compromises & Limitations

This project is a web port of the AgentEasy iOS app (`hazbot-mobile`, which
remains untouched). It's the same React Native + Expo codebase running in
the browser via `react-native-web`, forked so web-specific changes never
touch the iOS project. Every feature was carried over; the items below are
where the web version behaves differently from the iPhone app and why.

## Adapted (works, but differently than iOS)

### 1. Texting (SMS composer)
- **iOS:** opens the native Messages composer pre-filled; the user taps
  Send from their own number (`expo-sms`).
- **Web:** `src/sms.web.ts` replaces the composer:
  - **Phone browsers** open an `sms:` link that hands off to the device's
    messaging app with the message body pre-filled.
  - **Desktop browsers** copy the message to the clipboard and show a
    "Message copied — paste it into your texting app" toast (there is no
    SMS handler on most desktops).
- Affects: showing confirmations (Showings tab + calendar), Text buttons on
  contacts/tenants, and team invite texts.
- The "reminder sent" tracking treats a successful hand-off/copy as sent —
  the browser cannot confirm the user actually sent the message.

### 2. Add to Contacts
- **iOS:** opens the native "New Contact" form via `expo-contacts`.
- **Web:** `src/deviceContacts.web.ts` downloads a standard vCard (`.vcf`)
  with the person's name, phone, email, and a note about their inquiry.
  Opening the file imports it into the OS/phone contacts app.

### 3. App lock (Face ID / Touch ID)
- **iOS:** biometric unlock via `expo-local-authentication`, with PIN
  fallback.
- **Web:** PIN only (`src/security.web.ts` reports biometrics unavailable —
  a WebAuthn/passkey upgrade is possible later if wanted). The Security
  settings screen simply doesn't offer the biometric toggle.

## Skipped on web (silent no-ops, by design)

### 4. Push / local notifications
- New-lead alerts, showing reminders, and unit-activity pushes are native
  (`expo-notifications`). On web they are no-ops (`src/notifications.web.ts`).
  In-app UI (badges, toasts, lists) still updates normally. Real web push
  would need a backend + service worker — deferred until there's a backend.

### 5. Haptics, status bar, splash screen
- Cosmetic native touches with no web meaning; skipped.

## Inherited limitations (true of the iOS app too)

### 6. No real backend
- The entire app runs on mock data (`src/api/index.ts`) persisted to
  browser `localStorage` (AsyncStorage's web target). Every API function is
  marked `TODO: replace with real API`.
- Consequence on web: **data does not sync between devices or browsers** —
  each browser profile has its own isolated state, and clearing site data
  resets the app (back to onboarding).

### 7. Payments
- The paywall/subscription flow is a mock (no real IAP on iOS either).
  A real web version would use Stripe or similar.

### 8. `mailto:` / `tel:` links
- Kept as-is. They work on phones and on desktops with a configured
  mail/call handler; on a desktop with no handler the browser ignores the
  click (the app shows a "No mail app configured" toast where detectable).

## Notes

- **Desktop layout:** the app itself renders as a centered phone-width
  column (the `PhoneFrame` wrapper in `src/app/_layout.tsx`) — full-bleed
  on phone browsers, and on screens ≥900px wide it's flanked by a branded
  panel (logo, tagline, feature highlights) so the page reads as a real
  website rather than a bare embed. The app column deliberately stays
  phone-width: every screen is a mobile design, and stretching them to
  desktop widths would be a redesign, not a port.
- **Hover states:** tappable cards lift slightly on mouse hover
  (`src/components/pressableCard.tsx`) — inert on touch devices and native.
- Deploy: `npx expo export --platform web` produces a static site in
  `dist/` that can be hosted anywhere (Netlify, Vercel, S3, etc.).
