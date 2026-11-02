import { StoreLineMatch } from '#/graphql/generated/schemaTypes';
import type { ListSavingsQuery } from '#features/shoppingList/hooks/useListSavings.generated';
import { asAbbreviation } from './unitLabels';

export type SavingsAnswer = ListSavingsQuery['shoppingListStoreSavings'];
export type SavingsCandidate = SavingsAnswer['candidates'][number];
export type SavingsCell = SavingsCandidate['lines'][number];

export const ANSWERED_AT = '2026-10-29T15:00:00.000Z';
export const SEEN_TODAY = '2026-10-29T09:00:00.000Z';

const USD: SavingsAnswer['currency'] = {
  __typename: 'Currency',
  id: 'usd',
  code: 'USD',
  decimalPlaces: 2,
};

export const OZ: SavingsCell['packageNetWeightUnit'] = asAbbreviation({
  __typename: 'Unit',
  id: 'u-oz',
  symbol: 'oz',
});

export const savingsStore = (
  id: string,
  name: string,
): NonNullable<SavingsCandidate['store']> => ({
  __typename: 'Store',
  id,
  name,
  address: null,
});

export const GIANT_EAGLE = savingsStore('s-ge', 'Giant Eagle Banksville');
export const ALDI = savingsStore('s-aldi', 'ALDI Banksville');
export const KROGER = savingsStore('s-kroger', 'Kroger Mt Lebanon');

export const savingsLine = (
  id: string,
  itemName: string,
): SavingsCell['line'] => ({
  __typename: 'ShoppingListItem',
  version: 1,
  id,
  itemName,
  image: null,
});

/** A current Same price; each case states what differs. */
export const cell = (
  line: SavingsCell['line'],
  overrides: Partial<SavingsCell> = {},
): SavingsCell => ({
  __typename: 'StoreSavingsLine',
  line,
  kind: StoreLineMatch.Same,
  amount: 3.49,
  isCurrent: true,
  observedAt: SEEN_TODAY,
  product: null,
  packageNetWeight: null,
  packageNetWeightUnit: null,
  ...overrides,
});

/** A store with a total and no saving; each case states what differs. */
export const candidate = (
  store: SavingsCandidate['store'],
  overrides: Partial<SavingsCandidate> = {},
): SavingsCandidate => ({
  __typename: 'StoreSavingsCandidate',
  store,
  chain: null,
  isTarget: false,
  standIn: null,
  total: 60,
  savingVsTarget: null,
  lines: [],
  ...overrides,
});

export const saving = (
  amount: number,
  coveredLines: number,
  aboutTheSame = false,
): SavingsCandidate['savingVsTarget'] => ({
  __typename: 'StoreSaving',
  amount,
  targetAmount: 60,
  coveredLines,
  aboutTheSame,
});

export const savingsAnswer = (
  candidates: SavingsCandidate[],
): SavingsAnswer => ({
  __typename: 'ShoppingListStoreSavings',
  answeredAt: ANSWERED_AT,
  currency: USD,
  candidates,
});
