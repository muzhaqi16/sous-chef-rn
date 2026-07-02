/**
 * Push-token platform boundary.
 *
 * The transport differs per platform — iOS acquires an APNs token (no Firebase),
 * Android an FCM token (via @react-native-firebase/messaging) — but the rest of
 * the app only needs "give me a token" and "tell me when it rotates". This
 * module is that seam.
 *
 * The native providers are NOT imported here: importing an uninstalled native
 * module would break the Metro bundle. Instead the app injects the real provider
 * at startup via `setPushTokenProvider(...)` once the native modules are
 * installed (see docs/push-setup-checklist.md). Until then the no-op provider is
 * active, so `pushToken` stays undefined — exactly today's behavior — and
 * nothing else changes.
 */

export interface PushTokenProvider {
  /** Request OS notification permission. Resolves to whether it was granted. */
  requestPermission(): Promise<boolean>;
  /** The current push token, or null if unavailable / permission denied. */
  getToken(): Promise<string | null>;
  /**
   * Subscribe to token rotation (the OS periodically reissues tokens). Returns
   * an unsubscribe function.
   */
  onTokenRefresh(listener: (token: string) => void): () => void;
}

/** Inert provider used until a real native provider is injected. */
export const noopPushTokenProvider: PushTokenProvider = {
  requestPermission: async () => false,
  getToken: async () => null,
  onTokenRefresh: () => () => {},
};

let activeProvider: PushTokenProvider = noopPushTokenProvider;

/** Install the real (native) provider at app startup. */
export function setPushTokenProvider(provider: PushTokenProvider): void {
  activeProvider = provider;
}

export function getPushTokenProvider(): PushTokenProvider {
  return activeProvider;
}

/**
 * Acquire a push token, gated on the user's `pushEnabled` preference and OS
 * permission. Returns null (no token registered) when push is disabled, denied,
 * or the platform provider is the no-op default.
 */
export async function acquirePushToken(options?: {
  pushEnabled?: boolean;
}): Promise<string | null> {
  if (options?.pushEnabled === false) return null;
  const granted = await activeProvider.requestPermission();
  if (!granted) return null;
  return activeProvider.getToken();
}

/** Subscribe to token rotation on the active provider. */
export function onPushTokenRefresh(
  listener: (token: string) => void,
): () => void {
  return activeProvider.onTokenRefresh(listener);
}
