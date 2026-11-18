/**
 * What the catalog pickers find, for a form test that picks a unit, a brand
 * or a store: litres and grams, Horizon, and the Corner Shop.
 */
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  AutocompleteCategoriesDocument,
  SearchBrandsDocument,
} from '#operations/item/item.generated';
import {
  GetCommonUnitsDocument,
  SearchUnitsDocument,
} from '#operations/item/unit.generated';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { recordMock } from '../apolloMockProvider';
import { asAbbreviation } from './unitLabels';

export const LITER = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-l',
  name: 'liter',
  symbol: 'L',
  type: UnitType.Volume,
});
export const GRAM = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-g',
  name: 'gram',
  symbol: 'g',
  type: UnitType.Weight,
});

/** The units the device holds, as a fresh preload left them. */
export const HELD_UNITS = [LITER, GRAM].map(unit => ({
  ...unit,
  localizedNameForms: { one: unit.name, other: `${unit.name}s` },
}));

/** Every search a picker sends, the unit search answered by what was typed. */
export const catalogSearches = () => [
  recordMock(SearchUnitsDocument, {
    dataFor: ({ query }) => ({
      searchUnits: HELD_UNITS.filter(
        unit => typeof query === 'string' && unit.name.startsWith(query),
      ),
    }),
  }),
  recordMock(SearchBrandsDocument, {
    data: {
      brands: {
        __typename: 'BrandConnection',
        edges: [
          {
            __typename: 'BrandEdge',
            node: { __typename: 'Brand', id: 'brand-horizon', name: 'Horizon' },
          },
        ],
      },
    },
  }),
  recordMock(SearchStoresDocument, {
    data: {
      stores: {
        __typename: 'StoreConnection',
        edges: [
          {
            __typename: 'StoreEdge',
            node: { __typename: 'Store', id: 'store-tj', name: 'Corner Shop' },
          },
        ],
      },
    },
  }),
  recordMock(AutocompleteCategoriesDocument, {
    data: {
      autocompleteCategories: {
        __typename: 'AutocompleteCategoryResult',
        suggestions: [],
      },
    },
  }),
  recordMock(GetCommonUnitsDocument, { held: true }),
  recordMock(MyFeatureFlagsDocument, { held: true }),
];
