import type {
  UnitSystem,
  UsualStoreTargetInput,
} from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { formatDistance } from '#/utils/formatters/number';

/** A store, or a whole chain ("any ALDI"), as a household picks or keeps one. */
export type StoreChoice =
  | { store: { id: string; name: string }; chain?: undefined }
  | { chain: { id: string; name: string }; store?: undefined };

/** A choice's key on the device: its store, else its chain. */
export const storeChoiceKey = (choice: StoreChoice): string =>
  choice.store ? `store:${choice.store.id}` : `chain:${choice.chain.id}`;

/** A choice as every usual-store write names it. */
export const storeChoiceTarget = (
  choice: StoreChoice,
): UsualStoreTargetInput =>
  choice.store ? { storeId: choice.store.id } : { chainId: choice.chain.id };

interface ChoiceRecord {
  store?: { id: string; name: string } | null;
  chain?: { id: string; name: string } | null;
}

/** The choice a record names: its store, else its chain; null for neither. */
export const storeChoiceOf = ({
  store,
  chain,
}: ChoiceRecord): StoreChoice | null =>
  store
    ? { store: { id: store.id, name: store.name } }
    : chain
    ? { chain: { id: chain.id, name: chain.name } }
    : null;

interface StorePlace {
  address?: string | null;
  storeNumber?: string | null;
}

/** Which branch of a chain a store is: its address, else its store number. */
export const storeBranchLabel = (
  { address, storeNumber }: StorePlace,
  t: Translate,
): string | undefined => {
  const where = firstNonBlank(address);
  if (where) return where;
  return storeNumber ? t('labels.storeNumber', { number: storeNumber }) : undefined;
};

/** A store, or a whole chain, as a list offers it. */
export interface StoreOption {
  key: string;
  choice: StoreChoice;
  address: string | null;
  storeNumber: string | null;
  /** From the place searched near; null without one, and for a chain. */
  distanceKm: number | null;
  /** Already one of the household's stores. */
  added: boolean;
}

interface StoreRecord {
  id: string;
  name: string;
  address?: string | null;
  storeNumber?: string | null;
}

export const storeOption = (
  store: StoreRecord,
  { distanceKm = null, added = false }: Partial<StoreOption> = {},
): StoreOption => {
  const choice: StoreChoice = { store: { id: store.id, name: store.name } };
  return {
    key: storeChoiceKey(choice),
    choice,
    address: store.address ?? null,
    storeNumber: store.storeNumber ?? null,
    distanceKm,
    added,
  };
};

export const chainOption = (
  chain: { id: string; name: string },
  added = false,
): StoreOption => {
  const choice: StoreChoice = { chain: { id: chain.id, name: chain.name } };
  return {
    key: storeChoiceKey(choice),
    choice,
    address: null,
    storeNumber: null,
    distanceKm: null,
    added,
  };
};

/** A choice's name: the store's, or the chain's as any of its stores. */
export const storeChoiceName = (choice: StoreChoice, t: Translate): string =>
  choice.store
    ? choice.store.name
    : t('labels.anyStore', { chain: choice.chain.name });

/** What a store's row reads: its name, then its branch and distance. */
export const describeStoreOption = (
  option: StoreOption,
  t: Translate,
  readingSystem: UnitSystem,
): { title: string; subtitle: string | undefined } => {
  const parts = [
    storeBranchLabel(option, t),
    option.distanceKm === null
      ? undefined
      : formatDistance(option.distanceKm, readingSystem, t),
  ].filter(part => part !== undefined);
  return {
    title: storeChoiceName(option.choice, t),
    subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
  };
};
