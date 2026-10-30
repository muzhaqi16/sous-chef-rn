import type { EffectCallback } from 'react';
import type {
  DensityPreference,
  FontScalePreference,
  ThemePreference,
} from '#store/slices/preferenceTypes';
import type { ImageFile } from '#/types/media';

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
 * resolves; the host starts opening it before any React code runs. Members are
 * called with the `deviceStorage` proxy as `this`, so none may rely on it.
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

export interface ImagePrefetch {
  /** Warms the image cache; never throws. */
  prefetch(uris: string[]): void;
}

/** What the network reports; `isConnected: null` is before its first report. */
export interface ConnectivityState {
  isConnected: boolean | null;
  /** `null` until the host has probed it. */
  isInternetReachable: boolean | null;
  type: string;
}

export interface Connectivity {
  /** Reports the current state soon after, then every change; returns the unsubscribe. */
  subscribe(listener: (state: ConnectivityState) => void): () => void;
}

/** The feedback an action gives when it runs; a host without it does nothing. */
export interface Haptics {
  selection(): void;
  warning(): void;
}

/** The OS's own rating prompt; whether it appears is the OS's call. */
export interface ReviewPrompt {
  request(): void;
}

/** Whether the device's place may be read; `null` until the person is asked. */
export type LocationAccess = 'granted' | 'denied' | 'blocked' | 'unavailable';

/**
 * The device's place, about a kilometre wide: enough to find nearby stores.
 * Asked for only when the person wants it, and never more precise.
 */
export interface ApproximateLocation {
  access(): Promise<LocationAccess | null>;
  /** The OS's own prompt; the answer it settles on. */
  requestAccess(): Promise<LocationAccess>;
  /** Null when the device cannot say where it is. */
  currentPlace(): Promise<{ lat: number; lng: number } | null>;
  openSettings(): void;
}

/** How a picked file joins a multipart body. */
export interface FileParts {
  append(form: FormData, name: string, file: ImageFile, mimeType: string): void;
}

/**
 * Where the core asks to go, named by destination rather than by route. The
 * host maps each onto its own navigation; the core never names a screen.
 */
export interface NavigationIntents {
  /** Back, when there is somewhere to go back to. */
  goBack(): void;
  toAuth(): void;
  toVerifyEmail(): void;
  toJoinHomeByCode(joinCode?: string): void;
  toJoinByShareCode(shareCode: string): void;
  toRecipeDetail(params: { recipeId: string }): void;
  toRecipeCreate(params?: { captureId?: string }): void;
}

/**
 * Hooks over the host's navigator, called inside a screen: the screen a hook
 * runs in is the one it navigates from and whose focus it reads.
 */
export interface ScreenHooks {
  useNavigationIntents(): NavigationIntents;
  /** Runs while the screen is focused; a new `effect` identity re-runs it. */
  useScreenFocusEffect(effect: EffectCallback): void;
}

export interface PlatformServices {
  environment: Env;
  keyValueStore: KeyValueStore;
  secureStore: SecureStore;
  platformInfo: PlatformInfo;
  appLifecycle: AppLifecycle;
  connectivity: Connectivity;
  appearance: Appearance;
  imagePrefetch: ImagePrefetch;
  haptics: Haptics;
  reviewPrompt: ReviewPrompt;
  approximateLocation: ApproximateLocation;
  fileParts: FileParts;
  screen: ScreenHooks;
}
