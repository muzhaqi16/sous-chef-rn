/**
 * The app state telemetry gates on, with no imports: the store registers it as
 * it is created, so the store never loads telemetry and telemetry never loads
 * the store. A process that has not loaded the store asks the host to.
 */
export interface TelemetryStateSource {
  /** The saved choices have been read; until then consent is unknown. */
  consentKnown(): boolean;
  /** Called once, when consent becomes known. */
  onConsentKnown(listener: () => void): void;
  userConsent(): boolean | null;
  isOnline(): boolean;
}

export type TelemetryConsent = 'unknown' | 'declined' | 'allowed';

let source: TelemetryStateSource | null = null;
let loadSource: (() => void) | null = null;
let consentKnownListeners: (() => void)[] = [];

const notifyConsentKnown = (): void => {
  const listeners = consentKnownListeners;
  consentKnownListeners = [];
  listeners.forEach(listener => listener());
};

export function setTelemetryStateSource(next: TelemetryStateSource): void {
  source = next;
  next.onConsentKnown(notifyConsentKnown);
}

/**
 * How the host loads the state source in a process that renders nothing, such
 * as a push handled with the app closed. Called at most once.
 */
export function registerTelemetryStateLoader(load: () => void): void {
  loadSource = load;
}

export function telemetryConsent(): TelemetryConsent {
  if (!source) {
    const load = loadSource;
    loadSource = null;
    load?.();
    return 'unknown';
  }
  if (!source.consentKnown()) {
    return 'unknown';
  }
  return source.userConsent() === false ? 'declined' : 'allowed';
}

/** Calls `listener` once, when consent becomes known. */
export function onTelemetryConsentKnown(listener: () => void): void {
  consentKnownListeners.push(listener);
}

export function isTelemetryDeviceOffline(): boolean {
  return source?.isOnline() === false;
}
