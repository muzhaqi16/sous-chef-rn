/**
 * What each catalog write changes on the device, as a pending layer. The
 * server's answer writes its own rows; `commit` adds what it cannot state.
 */
import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import { storeChoiceKey, type StoreChoice } from '#domain/stores';
import {
  writeLocalStore,
  type LocalStore,
} from '#features/catalog/cache/localStore';
import {
  listStorageLocation,
  unlistStorageLocation,
  writeLocalStorageLocation,
  type LocalStorageLocation,
} from '#features/catalog/cache/storageLocations';
import {
  isUsualStoreList,
  keepUsualStores,
  localUsualStore,
  replaceUsualStore,
  writeUsualStores,
} from '#features/catalog/cache/usualStores';
import {
  hideSuggestion,
  putSuggestionsBack,
  type HeldSuggestion,
  type SuggestionParent,
} from '#features/catalog/cache/suggestions';

const locationRef = (id: string) => ({ __typename: 'StorageLocation', id });

export type CreateLocationInputs = {
  location: LocalStorageLocation;
  homeId: string;
  pantryId?: string;
};

export const createLocation: LocalWrite<CreateLocationInputs> = {
  apply(cache, { inputs: { location, homeId, pantryId } }) {
    if (!isHeld(cache, locationRef(location.id))) {
      writeLocalStorageLocation(cache, location);
    }
    listStorageLocation(cache, location.id, homeId, pantryId);
  },
  commit(cache, { inputs: { location, homeId, pantryId } }, data) {
    const payload: unknown = appliedPayload(data);
    const created = isRecord(payload) ? payload.storageLocation : undefined;
    const answered = isRecord(created) ? created.homeId : undefined;
    listStorageLocation(
      cache,
      location.id,
      typeof answered === 'string' ? answered : homeId,
      pantryId,
    );
  },
};

export type LocationFieldsInputs = {
  id: string;
  /** What the row shows meanwhile, in its own field names. */
  fields: Readonly<Record<string, unknown>>;
  /** The default the server moves off, which its answer does not state. */
  displacedId?: string;
};

function clearDefault(cache: ApolloCache, displacedId: string | undefined) {
  if (displacedId) {
    writeEntityFields(cache, locationRef(displacedId), { isDefault: false });
  }
}

export const locationFields: LocalWrite<LocationFieldsInputs> = {
  apply(cache, { inputs: { id, fields, displacedId } }) {
    if (isHeld(cache, locationRef(id))) {
      writeEntityFields(cache, locationRef(id), fields);
    }
    clearDefault(cache, displacedId);
  },
  commit(cache, { inputs: { displacedId } }) {
    clearDefault(cache, displacedId);
  },
};

export type RemoveLocationInputs = { pantryId?: string };

const locationIdOf = (variables: OperationVariables): string | null => {
  const input: unknown = variables.input;
  return isRecord(input) && typeof input.id === 'string' ? input.id : null;
};

export const removeLocation: LocalWrite<RemoveLocationInputs> = {
  apply(cache, { variables, inputs: { pantryId } }) {
    const id = locationIdOf(variables);
    if (id) unlistStorageLocation(cache, id, pantryId, { evictItem: false });
  },
  commit(cache, { variables, inputs: { pantryId } }) {
    const id = locationIdOf(variables);
    if (id) unlistStorageLocation(cache, id, pantryId, { evictItem: true });
  },
};

export type CreateStoreInputs = { store: LocalStore };

export const createStore: LocalWrite<CreateStoreInputs> = {
  apply(cache, { inputs: { store } }) {
    if (!isHeld(cache, { __typename: 'Store', id: store.id })) {
      writeLocalStore(cache, store);
    }
  },
};

export type UsualStoreInputs = {
  homeId: string | null;
  choice: StoreChoice;
  now: string;
};

/** Each write answers the household's whole list, so they reach it in order. */
const usualStoresOf = {
  orderedBy: ({ inputs: { homeId } }: { inputs: UsualStoreInputs }) =>
    `usualStores:${homeId ?? 'own'}`,
};

function writeAnsweredList(
  cache: ApolloCache,
  homeId: string | null,
  data: unknown,
): void {
  const payload: unknown = appliedPayload(data);
  const answered = isRecord(payload) ? payload.usualStores : undefined;
  if (isUsualStoreList(answered)) writeUsualStores(cache, homeId, answered);
}

export const addUsualStore: LocalWrite<UsualStoreInputs> = {
  ...usualStoresOf,
  apply(cache, { inputs: { homeId, choice, now } }) {
    replaceUsualStore(
      cache,
      homeId,
      storeChoiceKey(choice),
      held =>
        held ?? localUsualStore(cache, choice, UsualStoreSource.Picked, now),
    );
  },
  commit(cache, { inputs: { homeId } }, data) {
    writeAnsweredList(cache, homeId, data);
  },
};

export type PinUsualStoreInputs = UsualStoreInputs & { pinned: boolean };

export const pinUsualStore: LocalWrite<PinUsualStoreInputs> = {
  ...usualStoresOf,
  apply(cache, { inputs: { homeId, choice, pinned } }) {
    replaceUsualStore(cache, homeId, storeChoiceKey(choice), held =>
      held ? { ...held, pinned, compared: pinned || held.compared } : null,
    );
  },
  commit(cache, { inputs: { homeId } }, data) {
    writeAnsweredList(cache, homeId, data);
  },
};

export const removeUsualStore: LocalWrite<UsualStoreInputs> = {
  ...usualStoresOf,
  apply(cache, { inputs: { homeId, choice } }) {
    replaceUsualStore(cache, homeId, storeChoiceKey(choice), () => null);
  },
  // A removal's answer names the list by its keys only.
  commit(cache, { inputs: { homeId } }, data) {
    const payload: unknown = appliedPayload(data);
    const kept = isRecord(payload) ? payload.usualStores : undefined;
    if (!Array.isArray(kept)) return;
    keepUsualStores(
      cache,
      homeId,
      kept.flatMap((entry: unknown) =>
        isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : [],
      ),
    );
  },
};

export type DismissSuggestionInputs = { parent: SuggestionParent };

const itemIdOf = ({ input }: OperationVariables): string | undefined => {
  const value: unknown = input;
  return isRecord(value) && typeof value.itemId === 'string'
    ? value.itemId
    : undefined;
};

const leaveSuggestions: LocalWrite<DismissSuggestionInputs>['apply'] = (
  cache,
  { variables, inputs: { parent } },
) => {
  const itemId = itemIdOf(variables);
  if (itemId) hideSuggestion(cache, parent, itemId);
};

export const dismissSuggestion: LocalWrite<DismissSuggestionInputs> = {
  apply: leaveSuggestions,
  // The answer states no list.
  commit: leaveSuggestions,
};

export type UndoDismissalInputs = {
  parent: SuggestionParent;
  held: HeldSuggestion[];
};

const returnSuggestion: LocalWrite<UndoDismissalInputs>['apply'] = (
  cache,
  { variables, inputs: { parent, held } },
) => {
  const itemId = itemIdOf(variables);
  if (itemId) putSuggestionsBack(cache, parent, itemId, held);
};

export const undoDismissal: LocalWrite<UndoDismissalInputs> = {
  apply: returnSuggestion,
  // The answer states no list.
  commit: returnSuggestion,
};
