# Hazbot Web — lead cockpit (website)

The Hazbot app as a **website**, ported from the iOS project (`hazbot-mobile`,
which remains untouched — this is a separate fork). Same codebase idea:
**Expo (React Native + TypeScript + Expo Router)** rendered in the browser via
`react-native-web`. Every screen, feature, and design token from the iOS app
is here; runs entirely on **mock data** persisted to the browser's
localStorage — no backend, no accounts, no API keys.

See **ISSUES.md** for every place the web version behaves differently from
the iPhone app (SMS, contacts, biometrics, notifications) and why.

## Run it locally

```bash
cd hazbot-web
npm install
npx expo start --web
```

Opens at http://localhost:8081 (or the next free port). Mock auth — any
email/password signs in. Dark mode follows the OS setting, with a manual
toggle in the Account tab header.

## Build & deploy

```bash
npx expo export --platform web
```

Produces a static site in `dist/` — host it anywhere (Netlify, Vercel, S3,
nginx). Every route is pre-rendered (`/showings`, `/contacts`, `/lead/[id]`,
settings screens, etc.).

## Layout

The app renders full-bleed on phone browsers and as a centered phone-width
column on desktop (see `PhoneFrame` in `src/app/_layout.tsx`) — a deliberate
choice to keep the mobile design intact rather than inventing a new desktop
layout.
