import { useRef, useState } from 'react';
import {
  storeChoiceKey,
  type PlaceChoice,
  type StoreChoice,
} from '#domain/stores';
import { useCreateStore } from './useCreateStore';
import { useCreateStoreFromPlace } from './useCreateStoreFromPlace';
import { useUsualStoreWrites } from './useUsualStoreWrites';
import { useUsualStores } from './useUsualStores';

/** What a tapped row offers: a store or chain, a place, or a typed name. */
export type Tapped = StoreChoice | PlaceChoice | { unlisted: string };

/** A store this visit made the household's, or found it already held. */
interface Picked {
  choice: StoreChoice;
  /** Added by this visit, so a second tap takes it back. */
  ours: boolean;
}

/** The key a typed name's row goes by. */
export const unlistedKey = (name: string) =>
  `name:${name.trim().toLowerCase()}`;

/**
 * What a tap on a store picker row does. Alone, it adds one store and
 * `onAdded` runs. With `several`, each tap adds a store, and a second tap takes
 * back one this visit added. Either way, a tap on a row whose write is
 * settling is ignored.
 */
export function useStorePicks({
  homeId,
  several,
  onAdded,
}: {
  homeId: string | null;
  several: boolean;
  onAdded: () => void;
}) {
  const writes = useUsualStoreWrites(homeId);
  const { createStore } = useCreateStore();
  const { createStoreFromPlace } = useCreateStoreFromPlace();
  const held = useUsualStores(homeId, { fetchPolicy: 'cache-first' });
  // This visit's picks, by the key of the row tapped: a place row comes back
  // as a store row once the list asks again, under its store's key.
  const [picked, setPicked] = useState<ReadonlyMap<string, Picked>>(new Map());
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const settle = (key: string, busy: boolean) => {
    setSettling(keys => {
      const next = new Set(keys);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // The stores this visit made, by the name or place that made them: taken
  // back and added again, a row reuses its store rather than making another.
  const madeRef = useRef(new Map<string, StoreChoice>());
  const made = async (
    key: string,
    create: () => Promise<StoreChoice | null>,
  ): Promise<StoreChoice | null> => {
    const known = madeRef.current.get(key);
    if (known) return known;
    const created = await create();
    if (created) madeRef.current.set(key, created);
    return created;
  };

  // A name alone with this home is the household's own label; a later receipt
  // from the same shop turns it into the real store. A place the search has
  // lost, or a search that is down, still adds by its name.
  const storeFor = async (tapped: Tapped): Promise<StoreChoice | null> => {
    if ('unlisted' in tapped) {
      return made(unlistedKey(tapped.unlisted), async () => {
        const created = await createStore({ name: tapped.unlisted, homeId });
        return created ? { store: created } : null;
      });
    }
    if (!('place' in tapped)) return tapped;
    const fromPlace = await made(`place:${tapped.place.id}`, async () => {
      const created = await createStoreFromPlace(tapped.place.id);
      return created ? { store: created } : null;
    });
    return fromPlace ?? storeFor({ unlisted: tapped.place.name });
  };

  // Settling too: a second tap would add twice and go back twice.
  const addOne = async (key: string, tapped: Tapped) => {
    settle(key, true);
    const choice = await storeFor(tapped);
    const added = !!choice && (await writes.add(choice));
    settle(key, false);
    if (added) onAdded();
  };

  // A place may turn out to be a store the household already has: it reads
  // as added, and a second tap leaves it.
  const heldKeys = new Set(held.stores?.map(row => row.key));
  const addOfSeveral = async (key: string, tapped: Tapped) => {
    settle(key, true);
    const choice = await storeFor(tapped);
    if (choice) {
      const alreadyHeld = heldKeys.has(storeChoiceKey(choice));
      if (alreadyHeld || (await writes.add(choice))) {
        setPicked(map => new Map(map).set(key, { choice, ours: !alreadyHeld }));
      }
    }
    settle(key, false);
  };

  const takeBack = async (
    tappedKey: string,
    key: string,
    choice: StoreChoice,
  ) => {
    settle(key, true);
    if (await writes.remove(choice)) {
      setPicked(map => {
        const next = new Map(map);
        next.delete(tappedKey);
        return next;
      });
    }
    settle(key, false);
  };

  const pickedAt = (key: string) =>
    [...picked].find(
      ([tapped, { choice }]) =>
        tapped === key || storeChoiceKey(choice) === key,
    );

  return {
    /** A row's tap: none while it settles, or for a store already held. */
    pressFor: (key: string, tapped: Tapped, added: boolean) => {
      if (settling.has(key)) return undefined;
      if (!several) {
        return added
          ? undefined
          : () => {
              void addOne(key, tapped);
            };
      }
      const [tappedKey, mine] = pickedAt(key) ?? [];
      if (tappedKey && mine?.ours) {
        return () => {
          void takeBack(tappedKey, key, mine.choice);
        };
      }
      return added || mine
        ? undefined
        : () => {
            void addOfSeveral(key, tapped);
          };
    },
    /** This visit's pick a row shows: by the row tapped, or the store it became. */
    pickOf: (key: string): Picked | undefined =>
      several ? pickedAt(key)?.[1] : undefined,
    /** A row whose write has not settled. */
    isSettling: (key: string) => settling.has(key),
  };
}
