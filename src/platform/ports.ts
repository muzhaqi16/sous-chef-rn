import type {
  DensityPreference,
  FontScalePreference,
  ThemePreference,
} from '#store/slices/preferenceTypes';

/**
 * Build-time configuration. Every value is a string or unset, and consumers
 * parse their own; an empty value arrives as unset.
 */
export interface Env {
  NODE_ENV?: string;
  API_URL?: string;
  WEB_SOCKET_URL?: string;
  API_KEY?: string;
  WEB_APP_URL?: string;
  GRAPHQL_BATCH_ENABLED?: string;
  SPOONACULAR_API_KEY?: string;
  OTLP_METRICS_ENDPOINT?: string;
  OTLP_METRICS_AUTH_USERNAME?: string;
  OTLP_METRICS_AUTH_PASSWORD?: string;
  OTLP_LOGS_ENDPOINT?: string;
  OTLP_LOGS_AUTH_USERNAME?: string;
  OTLP_LOGS_AUTH_PASSWORD?: string;
  GRAPHQL_TELEMETRY_SAMPLE_RATE?: string;
  DEV_API_URL?: string;
  DEV_WS_URL?: string;
  STAGING_API_URL?: string;
  STAGING_WS_URL?: string;
  PROD_API_URL?: string;
  PROD_WS_URL?: string;
  ENABLE_DEBUG_LOGS?: string;
  ENABLE_PRODUCTION_LOGS?: string;
  GIT_SHA?: string;
  BUILD_ID?: string;
  HERMES_PROFILE_STARTUP?: string;
  ALLOW_LAUNCH_ARG_AUTH?: string;
  FEATURE_FLAGS?: string;
}

/**
 * Synchronous key-value storage. Reads and writes throw until `ready()`
 * resolves; the host starts opening it before any React code runs.
 */
export interface KeyValueStore {
  set(key: string, value: string | number | boolean): void;
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  contains(key: string): boolean;
  remove(key: string): boolean;
  getAllKeys(): string[];
  clearAll(): void;
  ready(): Promise<void>;
  isReady(): boolean;
  /** The store fell back to an unencrypted copy: nothing secret may be written. */
  isRecovery(): boolean;
  /** It opened with nothing in it: a reinstall or cleared app data. */
  openedWithEmptyStore(): boolean;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/** `error` is a read that failed, never an absence: only `absent` means no session. */
export type SessionTokenLoadResult =
  | { status: 'ok'; tokens: SessionTokens }
  | { status: 'absent' }
  | { status: 'error' };

/** Only `absent` may lead to minting a new id. */
export type DeviceIdLoadResult =
  | { status: 'ok'; deviceId: string }
  | { status: 'absent' }
  | { status: 'error' };

/** A session's tokens, parked until the server confirms its revoke. */
export interface PendingRevocation {
  refreshToken: string;
  accessToken: string | null;
}

/** Storage for what must outlive the key-value store and stay out of it. */
export interface SecureStore {
  saveSessionTokens(tokens: SessionTokens): Promise<boolean>;
  loadSessionTokens(): Promise<SessionTokenLoadResult>;
  clearSessionTokens(): Promise<boolean>;
  saveDeviceId(deviceId: string): Promise<boolean>;
  loadDeviceId(): Promise<DeviceIdLoadResult>;
  addPendingRevocation(revocation: PendingRevocation): Promise<boolean>;
  loadPendingRevocations(): Promise<PendingRevocation[]>;
  removePendingRevocation(refreshToken: string): Promise<void>;
}

export interface PlatformInfo {
  os: 'ios' | 'android' | 'web';
  /** The installed build's version, which the server's client-version gate reads. */
  appVersion: string;
  isEmulator: boolean;
}

/** `unknown` is the state before the first report, which is not "away". */
export type AppLifecycleState =
  | 'active'
  | 'inactive'
  | 'background'
  | 'unknown';

export interface AppLifecycle {
  current(): AppLifecycleState;
  /** Returns the unsubscribe. */
  subscribe(listener: (state: AppLifecycleState) => void): () => void;
}

export interface AppearanceSettings {
  primaryColorOverride: string | null;
  densityPreference: DensityPreference | null;
  fontScalePreference: FontScalePreference | null;
  highContrast: boolean;
}

export interface Appearance {
  applyTheme(theme: ThemePreference): void;
  apply(settings: AppearanceSettings): void;
}

/**
 * No marks: a mark per operation appends to a buffer that lives as long as the
 * session, and clearing it filters the whole buffer each time.
 */
export interface Clock {
  /** Milliseconds on a monotonic clock, for durations only. */
  now(): number;
}

export type ImagePrefetch = (uris: string[]) => void;

export interface PlatformServices {
  environment: Env;
  keyValueStore: KeyValueStore;
  secureStore: SecureStore;
  platformInfo: PlatformInfo;
  appLifecycle: AppLifecycle;
  appearance: Appearance;
  clock: Clock;
  imagePrefetch: ImagePrefetch;
}
