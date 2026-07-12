# Push Notifications — Credentials & Architecture

How Sous Chef delivers mobile push, and how to create/manage the two send-side
**private keys**. Reference doc — the client and native wiring are already built
(see [Client wiring](#client-wiring-already-built)); this exists so the
credential setup and the auth model aren't rediscovered later.

## Transports (one per platform)

- **iOS → APNs** (Apple Push Notification service), directly. **No Firebase on
  iOS** — the Firebase pods are excluded from iOS autolinking in
  `react-native.config.js`.
- **Android → FCM** (Firebase Cloud Messaging), messaging module only — there is
  no Firebase-free background push on stock Android.

The server routes by `device.platform` (the client sends `IOS` / `ANDROID` in
`registerDevice`): **IOS → APNs**, **ANDROID → FCM**.

## How it works — the credential model

A push never travels app-to-app. Only Apple's / Google's servers deliver to a
device, and they only do so for a request signed with **your private key**:

```
event → backend → APNs / FCM → device
           ▲                       │
           └──── device token ──────┘   (the address, uploaded by the app)
```

Two distinct pieces of identity:

- **Device token** — Apple/Google hand this to the *app*; it is the *address* of
  one app install. The app uploads it via `registerDevice`. **Not secret.**
- **Private key** (the `.p8` / the service-account JSON) — the *credential* that
  proves the sender is allowed to push for this app. Held **only by the
  backend**; it never ships in the app binary.

The backend needs **both**: the token for *where*, the key for *permission*. It
signs each send:

- **APNs:** an ES256 JWT signed with the `.p8` → HTTP/2
  `POST https://api(.sandbox).push.apple.com/3/device/<token>`, header
  `apns-topic: <bundleId>`.
- **FCM:** an RS256 JWT built from the service-account JSON → exchanged for an
  OAuth2 access token (scope `firebase.messaging`) →
  `POST https://fcm.googleapis.com/v1/projects/<project>/messages:send`.

Because the key can push to *any* user of the app, it must never be in the
client — that is the whole reason for the client/server split.

## Creating the iOS APNs Auth Key (`.p8`)

1. [Apple Developer portal](https://developer.apple.com/account) →
   **Certificates, Identifiers & Profiles → Keys → +** (Register a New Key).
2. **Key Name:** e.g. `SousChef APNs` — no `@ & * ' " - .`.
3. Enable **Apple Push Notifications service (APNs)** → **Continue → Register**.
4. **Download** `AuthKey_<KeyID>.p8`. ⚠️ **You can download it only once** — if
   lost, revoke it and create a new one. Save it to a password manager / Vault
   immediately.

Record these — the backend needs all four:

| Value | Where to find it | Notes |
|---|---|---|
| `.p8` file | the download | the private key — **secret** |
| **Key ID** | key detail page / the `AuthKey_<KeyID>.p8` filename | 10 chars |
| **Team ID** | portal, top-right (this project: `KRR7955LB8`) | 10 chars |
| **Bundle ID** | Xcode target (`dev.souschef.app`) | becomes `apns-topic` |

The APNs key is **non-expiring** and **team-wide** ("one key is used for all of
your apps").

> The iOS entitlement `aps-environment` (in `ios/SousChef/SousChef.entitlements`)
> is `development` for Xcode/dev builds; the App Store build gets `production`.
> The backend's `APNS_PRODUCTION` flag must match — sandbox vs. production APNs
> hosts reject each other's device tokens.

## Creating the Android FCM service-account JSON

1. [Firebase Console](https://console.firebase.google.com) → project
   **`souschef-68c1a`** → **Project Settings → Service accounts → Generate new
   private key**.
2. This downloads a JSON containing `project_id`, `client_email`, and
   `private_key` — the send-side credential (**secret**).

Separately, the **client build** needs `google-services.json` (Firebase Console →
Project Settings → the Android app, package `dev.souschef.app`) in
`android/app/`. It is gitignored; CI injects it from the
`GOOGLE_SERVICES_JSON_BASE64` secret (see `.github/workflows/build-android.yml`).

> The service-account JSON (send side, backend secret) and `google-services.json`
> (client config) are **different files**. The JSON is a private key — never
> commit or paste it.

## Where the credentials live (backend config)

The keys are backend secrets. Full details are in the **API repo**
(`docs/guides/push-notifications.md`). Summary of the env vars:

| Var | Secret | Purpose |
|---|---|---|
| `APNS_AUTH_KEY` | Vault | the `.p8` PEM |
| `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` | — | JWT header + issuer + `apns-topic` |
| `APNS_PRODUCTION` | — | `false` = sandbox (dev), `true` = TestFlight / App Store |
| `FCM_SERVICE_ACCOUNT` | Vault | the whole service-account JSON |

## Security

- **Never commit** the `.p8`, the FCM service-account JSON, or
  `google-services.json` — all are gitignored.
- The `.p8` downloads **once**; store it immediately.
- **If a key leaks:** revoke it (Apple portal / Firebase console) and issue a new
  one. The old key keeps working until revoked, so rotate promptly.
- Keys rotate rarely; device **tokens** rotate often — the client re-sends via
  `updateDevice` (`onTokenRefresh`), and the backend prunes dead tokens
  automatically on `410` / `UNREGISTERED`.

## Client wiring (already built)

The mobile side is complete; pointers for future changes:

| Concern | Where |
|---|---|
| Acquire token (per platform) | `iosPushProvider` (APNs) / `nativePushProvider` (FCM), injected in `App.tsx`; sent via `authService` → `registerDevice` |
| iOS native forwarding | `AppDelegate` → `PushNotificationForwarder` (+ `SousChef-Bridging-Header.h`) → `RNCPushNotificationIOS` |
| Receive / tap → deep-link | `iosPushMessaging` / `nativePushMessaging` → `routeNotificationTap` (routes on `data.category`) |
| OS app-icon badge | `badgeSync` keeps it in sync with the unread count |

## Payload contract

Every push carries `notificationId` (dedup key — must match the WebSocket
notification id), `type` (the `NotificationType`, e.g. `LOW_STOCK`), `category`
(the `NotificationCategory` — routing → Pantry / Shopping tab, else the feed),
and `sourceId` / `sourceType` when set (source correlation, not used for
routing). **Where `title` / `body` live differs by platform:** iOS puts them in
`aps.alert` (the OS auto-displays it when backgrounded/killed), so they are *not*
in the iOS `data`; Android sends **data-only** (no `notification` block), so
`title` / `body` ride inside the FCM `data` and Notifee draws the tray entry.

**Foreground display is suppressed on iOS** (`AppDelegate`'s `willPresent`
returns `[]`) so no OS banner shows while the app is open — the in-app WebSocket
feed owns the foreground, matching Android. Silent (`content-available`) pushes
are completed by `iosPushMessaging` (`notification.finish()`) so iOS doesn't
throttle background delivery.

The badge is the live unread count, set by the server on each alert push and
kept current client-side by `badgeSync`. Send-side detail lives in the API repo
(`docs/api/notifications.md`, `docs/guides/push-notifications.md`).
