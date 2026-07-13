# Migration Plan — RNFB messaging permission API deprecation

_Status: **planned, not started**. No code or dependency changes in PR #166. Owner: TBD._

## Trigger

`@react-native-firebase/messaging@^25.1.0` JSDoc-marks its notification
**permission** API as `@deprecated`. Our lint (`@typescript-eslint/no-deprecated`)
surfaces exactly **3 warnings**, all in `src/services/push/nativePushProvider.ts`:

| Location | Symbol | Rule |
|---|---|---|
| `nativePushProvider.ts:33` | `requestPermission` | `@typescript-eslint/no-deprecated` |
| `nativePushProvider.ts:35` | `AuthorizationStatus` | `@typescript-eslint/no-deprecated` |
| `nativePushProvider.ts:36` | `AuthorizationStatus` | `@typescript-eslint/no-deprecated` |

The deprecation message says: _"Use react-native-permissions or expo-notifications
for notification permission requests instead. These APIs will be removed in a
future major release."_ (See [invertase/react-native-firebase#6283](https://github.com/invertase/react-native-firebase/issues/6283).)

**Important scoping note:** only the permission-request surface is deprecated.
`getMessaging`, `getToken`, and `onTokenRefresh` — the actual FCM token plumbing
this provider exists for — are **not** deprecated and stay as-is. The in-file
comment at `nativePushProvider.ts:14-18` currently claims "there is no
non-deprecated equivalent"; that is outdated — a replacement path does exist (see
below). Correct that comment as part of the migration.

## Current state

`nativePushProvider.requestPermission()` (Android-only) calls
`requestPermission(getMessaging())` and compares the result against
`AuthorizationStatus.AUTHORIZED` / `.PROVISIONAL`. Those three references are the
only deprecated usages in the app.

The app **already has a Notifee-based permission path**:
`src/services/permissions/PermissionService.ts` uses
`@notifee/react-native`'s `notifee.requestPermission()` + its own
`AuthorizationStatus` enum. This is the natural replacement — no new dependency
required.

## Target end-state

Move the Android notification-permission request out of
`@react-native-firebase/messaging` and onto either:

- **Option A (preferred): existing Notifee `PermissionService`.** Already in the
  tree, already used elsewhere, no new dependency. `nativePushProvider` delegates
  its `requestPermission()` to `PermissionService`, or the push-registration
  caller requests permission via `PermissionService` before asking the provider
  for a token.
- **Option B: `react-native-permissions`.** The library the deprecation notice
  names first. Adds a dependency; only choose if we want a single cross-cutting
  permissions abstraction beyond notifications.

Either way, `nativePushProvider` keeps `getMessaging` / `getToken` /
`onTokenRefresh` and drops `requestPermission` + `AuthorizationStatus`, clearing
all 3 warnings.

## Steps (Option A)

1. Add an Android notification-permission method to `PermissionService` (or reuse
   its existing `requestPermission()` path), returning a boolean granted/denied.
2. In `nativePushProvider.requestPermission()`, replace the
   `requestPermission(getMessaging())` + `AuthorizationStatus` block with a call
   into `PermissionService`. Keep the `Platform.OS !== 'android'` guard and the
   defensive `try/catch` → `false` fallback.
3. Remove the now-unused `requestPermission` and `AuthorizationStatus` imports
   from `@react-native-firebase/messaging`.
4. Update the stale `nativePushProvider.ts:14-18` comment to describe the current
   (post-migration) mechanism.
5. Verify: `npm run lint` shows 0 warnings on the file; on-device Android smoke of
   the push permission prompt + token registration still works.

## Blast radius

- One production file (`nativePushProvider.ts`) + one shared service
  (`PermissionService.ts`).
- Android push permission + token registration path. iOS is unaffected
  (`iosPushProvider` uses `PushNotificationIOS`).
- Requires an on-device Android verification (permission prompt is native).

## Risks / trade-offs

- **[Behavioral parity]** → Notifee's permission result maps to a different enum
  than FCM's; verify AUTHORIZED/PROVISIONAL both map to "granted" so provisional
  users aren't regressed. Test on a real device.
- **[Timing]** → Not urgent — the deprecated API still functions and the warnings
  are non-blocking. Schedule alongside the next push/notifications work so it
  rides an existing Android device-test cycle rather than forcing a standalone one.
