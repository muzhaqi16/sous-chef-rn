# Remote push — native setup checklist

The JS side is done: `authService` acquires a push token via
`src/services/push/pushTokenProvider.ts` and sends it on `registerDevice`, then
`updateDevice`s on rotation. Until a real native provider is injected, the
**no-op provider** is active, so `pushToken` stays `undefined` (today's
behavior). This checklist is the device-only work to make remote push actually
arrive — none of it is verifiable in CI/emulator without a real device + a
backend that sends to APNs/FCM.

**Transport decision:** iOS = APNs directly (no Firebase). Android = FCM via
`@react-native-firebase/messaging` (messaging module only — there is no
Firebase-free background push on stock Android).

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

## 2. Android (FCM, minimal Firebase)

- [ ] `npm i @react-native-firebase/app @react-native-firebase/messaging`
- [ ] Add `google-services.json` to `android/app/` (from a Firebase project —
      messaging only; no Analytics/Crashlytics needed).
- [ ] `android/build.gradle`: `classpath 'com.google.gms:google-services:<ver>'`;
      `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`.
- [ ] Give the backend the FCM **service-account JSON** (HTTP v1) so it can send.

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

## 4. Background/killed delivery + tap deep-link (Phase 7.3)

- [ ] Android: `messaging().setBackgroundMessageHandler(...)` in `index.js`.
- [ ] Tap handling: route via the server `actionUrl` / `sourceId` already on the
      notification payload (built in 2.10) to the right screen.
- [ ] Notifee continues to render the **foreground** notification.

## 5. Gate + verify

- [ ] Pass the user's `pushEnabled` preference into `acquirePushToken({
      pushEnabled })` at the call site if you want the app-level toggle to also
      gate acquisition (OS permission already gates it).
- [ ] Verify on a **real device** (both platforms) — emulators/simulators can't
      reliably receive remote push. Use the in-app **Send test notification**
      (Settings → Test) plus a real server push to confirm background delivery.
