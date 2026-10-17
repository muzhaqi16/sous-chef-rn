import { storeNameKey } from './storeNameKey';

/** A store as the device holds it; an address left out is one not known. */
export interface HeldStore {
  id: string;
  name: string;
  address: string | null;
  storeNumber: string | null;
}

/**
 * The one held store a receipt's reading can locate: no address or number, and
 * named one of `names` (merchant, chain) as the API keys a name. Two such stores
 * are none, as the API judges its own candidate.
 */
export function unlocatedStoreNamed(
  names: readonly (string | null | undefined)[],
  held: readonly HeldStore[],
): { id: string; name: string } | null {
  const keys = new Set(
    names.flatMap(name => {
      const key = name ? storeNameKey(name) : '';
      return key ? [key] : [];
    }),
  );
  const matches = new Map<string, string>();
  for (const store of held) {
    if (store.address?.trim() || store.storeNumber?.trim()) continue;
    if (keys.has(storeNameKey(store.name))) matches.set(store.id, store.name);
  }
  const [only, ...others] = matches;
  if (!only || others.length > 0) return null;
  const [id, name] = only;
  return { id, name };
}
