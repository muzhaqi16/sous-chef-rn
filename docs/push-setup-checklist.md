# Remote push — setup checklist

**Status (2026-07-02):**
- **Android — client DONE & validated.** The native FCM module is installed,
  `authService` acquires a real FCM token and sends it on `registerDevice`
  (validated live: token reached `RegisterDevice`), and the receive→tray→tap
  bridge (§4) is wired and validated on the emulator. The remaining work to make
  real push arrive is entirely **server-side** (§6) plus an optional manual smoke
  test (§7).
- **iOS — not started.** Client native setup (§1) + server APNs send (§6) both
  pending. The tap **router** is already platform-agnostic; only the iOS
  receive/display half is missing.

**Transport decision:** iOS = APNs directly (no Firebase). Android = FCM via
`@react-native-firebase/messaging` (messaging module only — there is no
Firebase-free background push on stock Android). The server therefore branches
on `device.platform` (the client sends `platform: 'ANDROID' | 'IOS'` in the
`registerDevice`/`updateDevice` input): **ANDROID → FCM HTTP v1**, **IOS → APNs**.

## 1. iOS (APNs, no Firebase)

- [ ] `npm i @react-native-community/push-notification-ios`
- [ ] `cd ios && pod install`
- [ ] Xcode → target → Signing & Capabilities → add **Push Notifications** and
      **Background Modes → Remote notifications**.
- [ ] Create an **APNs Auth Key** (.p8) in the Apple Developer portal; give it to
      the backend so it can send to APNs.
- [ ] `AppDelegate`: forward the native registration callbacks
      (`didRegisterForRemoteNotificationsWithDeviceToken`, etc.) to
      `RNCPushNotificationIOS` per that library's README.

## 2. Android (FCM, minimal Firebase) — DONE

- [x] `@react-native-firebase/app` + `@react-native-firebase/messaging` installed.
- [x] `google-services.json` in `android/app/` (project `souschef-68c1a`, package
      `dev.souschef.app`). Gitignored; CI injects it from the
      `GOOGLE_SERVICES_JSON_BASE64` secret (see `.github/workflows/build-android.yml`).
- [x] `android/build.gradle` classpath + `android/app/build.gradle` conditional
      `apply plugin` (guarded on the file existing, so a build without the secret
      still succeeds).
- [ ] **Server:** obtain the FCM **service-account JSON** for `souschef-68c1a`
      (Firebase console → Project Settings → Service accounts → *Generate new
      private key*) and store it as a backend secret — see §6. **Never commit it
      or paste it anywhere; it is the send-side private key.**

## 3. Inject the provider (JS — one small file, added after installs)

Create `src/services/push/nativePushProvider.ts` implementing `PushTokenProvider`
(it imports the native modules, so it must only be imported after they're
installed), and call `setPushTokenProvider(nativePushProvider)` once at app
startup (e.g. in `App.tsx`, alongside the existing init). Sketch:

```ts
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import type { PushTokenProvider } from './pushTokenProvider';

export const nativePushProvider: PushTokenProvider = {
  async requestPermission() {
    if (Platform.OS === 'ios') {
      const p = await PushNotificationIOS.requestPermissions();
      return !!(p.alert || p.badge || p.sound);
    }
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  },
  async getToken() {
    if (Platform.OS === 'ios') {
      return new Promise(resolve => {
        PushNotificationIOS.addEventListener('register', resolve);
        PushNotificationIOS.addEventListener('registrationError', () =>
          resolve(null),
        );
      });
    }
    return messaging().getToken();
  },
  onTokenRefresh(listener) {
    if (Platform.OS === 'ios') {
      PushNotificationIOS.addEventListener('register', listener);
      return () => PushNotificationIOS.removeEventListener('register');
    }
    return messaging().onTokenRefresh(listener);
  },
};
```

## 4. Background/killed delivery + tap deep-link (Phase 7.3) — DONE (Android JS side)

Implemented as JS wiring over the existing Notifee helper; no native code beyond
the FCM install in §2. Files:

- `src/services/push/nativePushMessaging.ts` — `registerFcmBackgroundHandler()`
  (`setBackgroundMessageHandler`, registered in `index.js` at module scope) draws
  **data-only** messages via Notifee; it **skips** messages carrying a
  `notification` block because the OS auto-displays those (avoids a duplicate
  tray entry). `registerFcmTapHandlers()` (`onNotificationOpenedApp` +
  `getInitialNotification`, mounted in `useNotificationListener`) routes taps on
  those OS-auto-displayed messages.
- `src/services/push/pushNotificationRouting.ts` — `routeNotificationTap(data)`
  maps `data.category` → screen via the imperative `NavigationService` (works
  from a killed launch). Mirrors the in-app `handleNotificationPress` mapping.
- `localNotificationHelper.ts` — `showLocalNotification` now carries a `data`
  payload; `setupNotificationHandlers` routes Notifee `PRESS` events (taps on
  data-only pushes we drew ourselves) through the same router.

**Server payload contract (required for this to fire):** the backend must send an
FCM **data-only** message (no `notification` block) to the device token, with at
least `title`, `body`, and — for dedup + routing — `notificationId` and
`category`. A `notification`-block message will still be auto-displayed by the OS
in the background, but its tap routing then depends on the FCM tap handlers, and
foreground display would need `onMessage` (deliberately omitted — the in-app
WebSocket feed owns the foreground).

- [x] Android background/killed handler in `index.js`.
- [x] Tap handling → deep-link via `NavigationService` (Notifee taps for
      data-only; FCM taps for OS-auto-displayed).
- [x] Notifee renders backgrounded pushes (the WebSocket feed already drew
      backgrounded-but-alive pushes; dedup by notification `id` prevents doubles).
- [ ] iOS receive path: wire once §1 (APNs) lands — the router is already
      platform-agnostic; only the display/receive half is Android-only today.

## 5. Gate + verify

- [ ] Pass the user's `pushEnabled` preference into `acquirePushToken({
      pushEnabled })` at the call site if you want the app-level toggle to also
      gate acquisition (OS permission already gates it).
- [x] Android emulator: FCM token reaches `RegisterDevice`; a backgrounded
      notification renders in the tray and its tap deep-links (validated via the
      WebSocket→Notifee path — see §4). The **FCM-transport** killed/dozing path
      still needs a real server push (§6/§7) to exercise `setBackgroundMessageHandler`.
- [ ] iOS: verify on a **real device** — the simulator can't receive APNs.

---

## 6. Server integration (send side)

This is everything the **backend** must do. The client already persists nothing
itself — it just hands the server a token: every `registerDevice` / `updateDevice`
carries `input.pushToken` (the FCM registration token on Android, the APNs device
token on iOS) plus `input.platform` and a stable `input.deviceId`.

### 6a. Store & maintain tokens
- [ ] On `registerDevice` / `updateDevice`, persist `pushToken` + `platform` on
      the Device row, keyed by `(userId, deviceId)`. `deviceId` is stable across
      launches, so upsert on it — don't create duplicate device rows.
- [ ] Tokens rotate. The client re-sends via `updateDevice` on refresh
      (`onTokenRefresh`) — overwrite the stored token.
- [ ] Prune dead tokens: when a send returns `UNREGISTERED` (FCM) or `410 Gone`
      (APNs), delete that token so you stop sending to it.

### 6b. When to send
- [ ] For each Notification the server creates, if the target user's
      `pushEnabled` preference is on **and** it is **not** within their
      server-side IANA quiet hours (Phase 7.7 — the device may be asleep, so the
      server must gate; the client can't), fan out a push to each of that user's
      active device tokens, branching by `platform`.

### 6c. Android → FCM HTTP v1  ← **needed to test on Android**
- [ ] **Auth:** load the service-account JSON (§2) and mint an OAuth2 access
      token (scope `https://www.googleapis.com/auth/firebase.messaging`). Use the
      Google Admin SDK (`firebase-admin`) or `google-auth-library` — don't
      hand-roll JWTs.
- [ ] **Endpoint:** `POST https://fcm.googleapis.com/v1/projects/souschef-68c1a/messages:send`
      with `Authorization: Bearer <access-token>`.
- [ ] **Payload — MUST be data-only** (this is the contract the client's
      `toDisplayableNotification` enforces: a `notification` block would be
      OS-auto-displayed and our handler skips it to avoid a duplicate). All
      `data` values must be **strings**. Set `android.priority: "high"` so a
      **killed/dozing** device wakes to run the background handler:

  ```json
  {
    "message": {
      "token": "<device FCM token>",
      "android": { "priority": "high" },
      "data": {
        "notificationId": "<server notification id>",
        "title": "Milk is expiring",
        "body": "Use it within 2 days",
        "category": "PANTRY",
        "actionUrl": "souschef://pantry"
      }
    }
  }
  ```

  Client reads: `title`, `body` (display); `notificationId` (Notifee dedup id —
  must match the id sent over the WebSocket so the two paths don't double-show);
  `category` (tap routing: `SHOPPING` / `PANTRY` → that tab, else the feed).
  `actionUrl` is currently informational (routing is category-based today).
- [ ] **Recommended (Admin SDK):** `admin.messaging().send({ token, android: {
      priority: 'high' }, data: {...} })` — same shape, handles auth for you.

### 6d. iOS → APNs (later; documented so it isn't rediscovered)
- [ ] **Auth:** APNs **token-based** auth with the `.p8` **APNs Auth Key** (§1) —
      key ID + team ID + the `.p8`; mint a short-lived ES256 JWT. (Certificate
      auth also works but the .p8 key is simpler and non-expiring.)
- [ ] **Endpoint:** HTTP/2 `POST https://api.push.apple.com/3/device/<apnsToken>`
      (use `api.sandbox.push.apple.com` for debug builds). Header
      `apns-topic: <app bundle id>`.
- [ ] **Payload:** unlike Android, iOS auto-displays the `alert`, so send a
      normal APNs payload and set the same routing keys at the top level so the
      client's iOS tap handler (to be written in §1) can route:

  ```json
  {
    "aps": { "alert": { "title": "Milk is expiring", "body": "Use it within 2 days" }, "sound": "default" },
    "notificationId": "<server notification id>",
    "category": "PANTRY",
    "actionUrl": "souschef://pantry"
  }
  ```
- [ ] **Client (§1) still owes the iOS receive/display half:** foreground
      display + tap → `routeNotificationTap` (the router is already
      platform-agnostic; wire `PushNotificationIOS` `notification` / `localNotification`
      listeners to it, mirroring `registerFcmTapHandlers`). Background/killed
      display is handled by iOS itself from the `aps.alert`.

## 7. Manual smoke test — Android data-only (no full backend needed)

Proves the client's FCM receive→tray→tap path end-to-end before the backend send
side lands. Needs only the service-account JSON + a device token.

1. **Grab the device's current FCM token** from logcat right after login:
   ```bash
   adb logcat -s ReactNativeJS:V | grep -A2 "MUTATION RegisterDevice"
   # copy the pushToken value (the "<iid>:APA91b…" string)
   ```
2. **Mint an access token** from the service-account JSON (keep the file local;
   never commit/paste it):
   ```bash
   gcloud auth activate-service-account --key-file=service-account.json
   ACCESS_TOKEN=$(gcloud auth print-access-token)
   ```
3. **Send a data-only push:**
   ```bash
   curl -s -X POST \
     "https://fcm.googleapis.com/v1/projects/souschef-68c1a/messages:send" \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message":{"token":"<DEVICE_FCM_TOKEN>","android":{"priority":"high"},
          "data":{"notificationId":"smoke-1","title":"Smoke test","body":"Killed-app push works","category":"PANTRY"}}}'
   ```
4. **Test each state:** foreground (in-app feed only, no heads-up — by design);
   backgrounded (Home) → tray entry; **swiped-away / killed** → tray entry via
   `setBackgroundMessageHandler`. Tapping any of them opens the app to Pantry.

> Emulators with Google Play services (this AVD has them) do receive FCM. A
> physical device is still the final check, especially for Doze behavior.
