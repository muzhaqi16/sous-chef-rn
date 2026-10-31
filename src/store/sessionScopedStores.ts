/**
 * Feature stores a session end must clear (`SESSION_SCOPED_STATE` reaches only
 * the ROOT store). With `inlineRequires` an unused module never registers, so
 * PERSISTED keys are declared as DATA below and deleted without their module.
 */
import { storage } from '#/store/deviceStorage';
import { logger } from '#/utils/environment';

type StoreReset = () => void;

const stores = new Map<string, StoreReset>();

/**
 * The `name` each feature store passes to zustand's `persist`. A persisted store
 * missing here survives sign-out on a shared device.
 */
export const SESSION_SCOPED_PERSISTED_KEYS: string[] = [
  // features/recipes/store/recipeCaptureStore.ts: captured pages and recipes.
  'sous-chef-recipe-captures',
  // features/recipes/store/catalogFetchTimes.ts: when catalog answers arrived.
  'sous-chef-catalog-fetch-times',
  // features/receipts/store/receiptDraftStore.ts: the shop and what was bought.
  'sous-chef-receipt-draft',
  // features/receipts/store/receiptPhotoConsentStore.ts: this user's consent.
  'sous-chef-receipt-photo-consent',
  // features/catalog/store/storePickerStore.ts: the zip stores were found near.
  'sous-chef-store-picker',
];

/** Last write wins, so a hot reload replaces rather than duplicates. */
export const registerSessionScopedStore = (
  name: string,
  reset: StoreReset,
): void => {
  stores.set(name, reset);
};

/**
 * One failure must not skip the rest: a store left populated is the previous
 * person's data on a shared device.
 */
export const resetSessionScopedStores = (): void => {
  for (const [name, reset] of stores) {
    try {
      reset();
    } catch (error) {
      logger.warn(`[sessionScopedStores] "${name}" failed to reset`, error);
    }
  }

  // Independent of the loop above: a store whose module was never evaluated has
  // no registration, but its persisted key is still on disk.
  for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
    try {
      storage.remove(key);
    } catch (error) {
      logger.warn(`[sessionScopedStores] "${key}" failed to clear`, error);
    }
  }
};

/** @internal Test seam: the names currently registered. */
export const registeredSessionScopedStores = (): string[] => [...stores.keys()];
