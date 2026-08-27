/**
 * The shared-device guarantee: signing out removes the previous person's data.
 *
 * The review that motivated this found two sign-out paths that each cleared a
 * different subset of state, so what survived depended on which one the caller
 * happened to use. The profile screen's button — the one people actually press
 * — used the weaker one, and left the notification inbox, the scanner's recent
 * list and the item-autocomplete suggestions on disk for whoever signed in
 * next.
 *
 * Fixing those three fields is not what this file is for. It enumerates the
 * REAL persistence allowlist and requires every key in it to be either cleared
 * by a session end or named below with a reason. Add a persisted key and this
 * test fails until someone decides which it is — which is the mechanism the
 * original defect existed for lack of, not a list of the fields that were
 * wrong that day.
 */

// authSlice transitively imports tokenScheduler/refreshToken, which need
// native AppState. Same stubbing as the other store tests.
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

jest.mock('#/storage/keychain', () => ({
  clearTempRegistrationPassword: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearCredentials: jest.fn(() => Promise.resolve()),
}));

jest.mock('#/apollo/client', () => ({
  client: { clearStore: jest.fn(() => Promise.resolve()) },
}));

jest.mock('#/apollo/offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: { clear: jest.fn() },
}));

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useBarcodeScannerStore } from '#features/barcode/store/barcodeScannerStore';
import { registeredSessionScopedStores } from '#store/sessionScopedStores';
import { useStore, PERSISTED_KEYS } from '#store';

/**
 * Persisted keys a session end deliberately keeps, each with the reason.
 *
 * The bar is "cannot identify the previous person or show their content to the
 * next one". A key belongs here only if that holds — not merely because
 * clearing it would be inconvenient.
 */
const KEPT_ON_PURPOSE: Record<string, string> = {
  // Device-level appearance and input choices. They describe the device, not
  // the account, and resetting a family tablet's theme and language at every
  // sign-out would be a worse experience for no privacy gain.
  theme: 'device appearance choice, reveals nothing about the account',
  language: 'device language choice, reveals nothing about the account',
  primaryColorOverride: 'device appearance choice',
  densityPreference: 'device appearance choice',
  fontScalePreference: 'device accessibility choice',
  highContrast: 'device accessibility choice',
  hapticFeedbackEnabled: 'device input choice',
  showNavigationLabels: 'device appearance choice',
  pantrySortOption: 'sort order, carries no content',
  pantrySortDirection: 'sort order, carries no content',

  // Sign-in affordances, scoped per account by design.
  rememberMe: 'login preference; the credentials themselves are per-account',
  hasStoredCredentials:
    'whether ANY account has biometric credentials enrolled; the credentials ' +
    'are keyed by email and removed for the account signing out',
  showBiometricSetup: 'transient prompt flag, no account data',

  // Keyed by user id: the previous person's entry is unreachable without
  // signing in as them again, and it is what makes onboarding progress and
  // biometric prompt counts resume correctly for that account. Both hold only
  // per-account UI flags — no names, items, or messages.
  userPreferences: 'Record keyed by user id; per-account UI flags only',
  userNavigationStates: 'Record keyed by user id; per-account UI flags only',

  // Catalog data warmed for offline autocomplete. Identical for every account
  // and independent of who was signed in; clearing it costs offline
  // autocomplete and gains nothing.
  cachedUnits: 'shared catalog reference data',
  cachedCategories: 'shared catalog reference data',
  cachedBrands: 'shared catalog reference data',
  cachedStores: 'shared catalog reference data',
  lastUnitsFetchedAt: 'freshness stamp for shared catalog data',
  lastCategoriesFetchedAt: 'freshness stamp for shared catalog data',
  lastBrandsFetchedAt: 'freshness stamp for shared catalog data',
  lastStoresFetchedAt: 'freshness stamp for shared catalog data',

  // The route-level state machine. Set to 'auth' by the sign-out itself, so it
  // never carries a signed-in route forward.
  navigationState: "reset to 'auth' by the sign-out itself",

  // A consent decision about telemetry, recorded per device.
  userConsent: 'device-level telemetry consent, not account content',
};

/**
 * A value distinguishable from any legitimate post-sign-out value, planted in
 * every persisted key so "cleared" can be told from "happened to already be
 * empty" — the vacuity trap these checks exist to close.
 */
const MARKER = '__previous-person__';

const plantMarkers = () => {
  const planted: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) {
    planted[key] = [MARKER];
  }
  useStore.setState(planted as never);
};

/** Every persisted key still holding the planted marker after a sign-out. */
const keysStillHoldingMarker = (): string[] => {
  const state = useStore.getState() as unknown as Record<string, unknown>;
  return PERSISTED_KEYS.filter(key => {
    const value = state[key];
    return Array.isArray(value) && value[0] === MARKER;
  });
};

describe('a session end leaves no data belonging to the previous person', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears every persisted key that is not deliberately kept', async () => {
    plantMarkers();

    await useStore.getState().resetStore('LOGOUT');

    const survivors = keysStillHoldingMarker();
    const unexplained = survivors.filter(key => !(key in KEPT_ON_PURPOSE));

    expect(unexplained).toEqual([]);
  });

  it('clears the personal state a shared device would otherwise show', async () => {
    // The specific fields the review found. Named separately from the sweep
    // above so a regression reads as what it is, rather than as an unclassified
    // new key.
    useStore.setState({
      // The notification FEED is no longer store state — it lives in the
      // Apollo cache, which this same reset clears (`clearApolloCache: true` on
      // the logout path). What the store still holds for notifications is the
      // expiration buffer, and it is just as personal: it names a pantry item.
      pendingExpirationLinks: {
        n1: {
          expirationNotificationId: 'exp-1',
          pantryItemName: 'Insulin pens',
        },
      },
      cachedItemSuggestions: [{ id: 'i1', name: 'Insulin pens' }],
      selectedHomeId: 'home-1',
      selectedPantryId: 'pantry-1',
      selectedShoppingListId: 'list-1',
      selectedMealPlanId: 'plan-1',
      user: { id: 'u1', email: 'first@example.com' },
    } as never);

    await useStore.getState().resetStore('LOGOUT');

    const state = useStore.getState();
    expect(state.cachedItemSuggestions).toEqual([]);
    expect(state.selectedHomeId).toBeNull();
    expect(state.selectedPantryId).toBeNull();
    expect(state.selectedShoppingListId).toBeNull();
    expect(state.selectedMealPlanId).toBeNull();
    expect(state.user).toBeNull();
  });

  // A feature that owns its own store falls outside `PERSISTED_KEYS`, so the
  // marker sweep above cannot reach it — exactly how `recipe-search-cache` and
  // `recipe-suggestions-cache` came to survive a sign-out unnoticed. Feature
  // stores register a reset instead; this asserts the registry is wired and
  // that a populated feature store is actually emptied.
  it('clears feature-owned stores, which the persisted-key sweep cannot see', async () => {
    useNotificationStore
      .getState()
      .linkExpirationData('notif-1', { pantryItemName: 'previous person' });
    expect(useNotificationStore.getState().pendingExpirationLinks).not.toEqual(
      {},
    );

    await useStore.getState().resetStore('LOGOUT');

    expect(useNotificationStore.getState().pendingExpirationLinks).toEqual({});
    expect(registeredSessionScopedStores()).toContain('notifications');
  });

  it('clears the scanner history, which names what the previous person bought', async () => {
    useBarcodeScannerStore
      .getState()
      .addToRecentlyScanned({ id: 's1', name: 'Pregnancy test', upc: '0123' });
    expect(useBarcodeScannerStore.getState().recentlyScanned).toHaveLength(1);

    await useStore.getState().resetStore('LOGOUT');

    expect(useBarcodeScannerStore.getState().recentlyScanned).toEqual([]);
    expect(registeredSessionScopedStores()).toContain('barcodeScanner');
  });

  it('keeps the offline reference caches, which belong to no account', async () => {
    // The counterpart assertion: a session end that cleared these would pass
    // the sweep above while silently regressing offline autocomplete.
    useStore.setState({
      cachedUnits: [{ id: 'u1', name: 'gram' }],
      cachedCategories: [{ id: 'c1', name: 'Dairy' }],
    } as never);

    await useStore.getState().resetStore('LOGOUT');

    expect(useStore.getState().cachedUnits).toHaveLength(1);
    expect(useStore.getState().cachedCategories).toHaveLength(1);
  });

  it('every deliberately-kept key is still persisted, so the list cannot rot', () => {
    // A key removed from PERSISTED_KEYS but left here would quietly turn into
    // a stale exemption that outlives its subject — the failure mode this
    // whole change is about.
    const stale = Object.keys(KEPT_ON_PURPOSE).filter(
      key => !(PERSISTED_KEYS as readonly string[]).includes(key),
    );

    expect(stale).toEqual([]);
  });
});
