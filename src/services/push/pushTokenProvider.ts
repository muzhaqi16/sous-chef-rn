/**
 * Push-token platform boundary: iOS acquires an APNs token, Android an FCM one.
 * The native providers must NOT be imported here — importing an uninstalled
 * native module breaks the Metro bundle — so the app injects one at startup via
 * `setPushTokenProvider(...)` (docs/push-notifications.md).
 */

export interface PushTokenProvider {
  /** Resolves to whether OS notification permission was granted. */
  requestPermission(): Promise<boolean>;
  /** null if unavailable or permission denied. */
  getToken(): Promise<string | null>;
  /** Subscribe to OS token rotation; returns an unsubscribe. */
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
 * Gated on OS permission; null when denied or on the no-op provider. The
 * `pushEnabled` preference is enforced server-side at send time, so a registered
 * token is harmless when push is disabled there.
 */
export async function acquirePushToken(): Promise<string | null> {
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
