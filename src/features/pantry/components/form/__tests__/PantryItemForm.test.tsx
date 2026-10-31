'use no memo';

import { todayKey } from '#/utils/dateUtils';
import React from 'react';
import { makeCache } from '#/apollo/cache';
import type { InMemoryCache } from '@apollo/client';
import { screen, userEvent } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { PantryItemForEditDocument } from '../usePantryItemFormData.generated';
import { homeDetailNode } from '#/test-utils/fixtures/homeFixtures';
import { pantryData } from '#/test-utils/fixtures/pantryFixtures';
import { pantryItemData } from '#/test-utils/fixtures/pantryItemFixtures';
import { PantryItemForm } from '../PantryItemForm';
import { PantryItemForm_PantryItemFragmentDoc } from '../PantryItemForm.generated';
import {
  UnitSystem,
  UnitType,
  type StorageState,
} from '#/graphql/generated/schemaTypes';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import type { QueryDataFor } from '#/test-utils/apolloMockProvider';
import type { StorageLocationOption } from '#features/catalog/hooks/useStorageLocationAutocomplete';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
  useSelectedPantryId: jest.fn(() => 'p1'),
  useSelectedHomeId: jest.fn(() => 'h1'),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    container: { flex: 1 },
    center: { justifyContent: 'center', alignItems: 'center' },
    scrollContent: {},
    padding: {},
  },
}));

// Mutation hooks: behaviour covered by usePantryItemFormSubmit.test.ts.
jest.mock('#features/pantry/hooks/mutations/useUpdatePantryItem', () => ({
  useUpdatePantryItem: jest.fn(() => ({ updatePantryItemFields: jest.fn() })),
}));
jest.mock(
  '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity',
  () => ({
    useUpdatePantryItemQuantity: jest.fn(() => ({ updateQuantity: jest.fn() })),
  }),
);
jest.mock('#features/catalog/hooks/useResolveUnit', () => ({
  useResolveUnit: jest.fn(() => ({ resolveUnitId: jest.fn() })),
}));

jest.mock('#features/pantry/hooks/mutations/types', () => ({
  emptyUnitSelection: { id: null, name: null, symbol: null, type: null },
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => parseFloat(input) || 0),
}));

// Form sub-sections — exercised via their own focused tests.
jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({
    label,
    placeholder,
    value,
    onChangeText,
    error,
  }: {
    label?: string;
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    error?: string;
  }) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  },
}));

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: ({
    label,
    value,
    onChangeText,
    onUnitSelected,
    error,
    testID,
  }: {
    label?: string;
    value?: string;
    testID?: string;
    onChangeText?: (text: string) => void;
    onUnitSelected?: (
      unitId: string | null,
      unitName: string | null,
      unitType?: UnitType | null,
      unitSymbol?: string | null,
    ) => void;
    error?: string;
  }) => {
    const { Text, View, Pressable } = require('react-native');
    const { UnitType: UnitTypes } = require('#/graphql/generated/schemaTypes');
    return (
      <View testID="unit-autocomplete">
        {label ? <Text>{label}</Text> : null}
        <Text>{`unit:${value ?? ''}`}</Text>
        <Pressable
          testID={testID ? `${testID}-pick` : 'pick-unit'}
          onPress={() => {
            // The real field's onSelect order: the symbol first, then the id.
            onChangeText?.('lb');
            onUnitSelected?.('unit-lb', 'Pound', UnitTypes.Weight, 'lb');
          }}
        >
          <Text>Pick lb</Text>
        </Pressable>
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  },
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({ title }: { title?: string }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
      </View>
    );
  },
}));

jest.mock('#components/molecules/PageIndicator/PageIndicator', () => ({
  PageIndicator: ({
    pages,
    onPagePress,
  }: {
    pages: { label: string }[];
    onPagePress: (index: number) => void;
  }) => {
    const { Text, View, Pressable } = require('react-native');
    return (
      <View testID="page-indicator">
        {pages.map((p, i) => (
          <Pressable key={p.label} onPress={() => onPagePress(i)}>
            <Text>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/molecules/CollapsibleSection', () => ({
  CollapsibleSection: ({
    children,
    title,
  }: {
    children?: React.ReactNode;
    title?: string;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('#components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: ({
    fields,
  }: {
    fields: { name: string; label: string }[];
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        {fields.map(f => (
          <Text key={f.name}>{f.label}</Text>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/atoms/FieldRow', () => ({
  FieldRow: ({ children }: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

// Subscribes to a field the way the real section's `Controller`s do, so a
// form reset reaches a component other than the form.
jest.mock('../ItemInformationSection', () => ({
  ItemInformationSection: ({
    control,
  }: React.ComponentProps<
    typeof import('../ItemInformationSection').ItemInformationSection
  >) => {
    const { Text, View } = require('react-native');
    const { useWatch } = require('react-hook-form');
    const itemName = useWatch({ control, name: 'itemName' });
    return (
      <View testID="item-information-section">
        <Text>Item Information</Text>
        <Text>{`name:${itemName}`}</Text>
      </View>
    );
  },
}));

jest.mock('../QuantitySection', () => ({
  QuantitySection: ({
    testID,
    control,
  }: React.ComponentProps<
    typeof import('../QuantitySection').QuantitySection
  >) => {
    const { Text, View } = require('react-native');
    const { useWatch } = require('react-hook-form');
    const [quantityInput, minQuantity, restockQuantity] = useWatch({
      control,
      name: ['quantityInput', 'minQuantity', 'restockQuantity'],
    });
    return (
      <View testID={testID || 'quantity-section'}>
        <Text>Quantity</Text>
        <Text>{`seeded:${quantityInput}|${minQuantity}|${restockQuantity}`}</Text>
      </View>
    );
  },
}));

jest.mock('../StorageDetailsSection', () => ({
  StorageDetailsSection: ({
    storageState,
    onStorageLocationSelected,
  }: {
    storageState: StorageState;
    onStorageLocationSelected?: (
      locationId: string | null,
      location: StorageLocationOption | null,
    ) => void;
  }) => {
    const { Text, View, Pressable } = require('react-native');
    const {
      StorageState: StorageStates,
      StorageType,
    } = require('#/graphql/generated/schemaTypes');
    return (
      <View testID="storage-details-section">
        <Text>Storage Details</Text>
        <Text testID="storage-state">{storageState}</Text>
        <Pressable
          testID="pick-frozen-location"
          onPress={() =>
            onStorageLocationSelected?.('loc-freezer', {
              id: 'loc-freezer',
              name: 'Freezer',
              type: StorageType.Freezer,
              isDefault: false,
              temperature: StorageStates.Frozen,
            })
          }
        >
          <Text>Pick freezer</Text>
        </Pressable>
      </View>
    );
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Build a cache pre-populated with the upstream queries the form fires:
 *   - GetHome (selected home with at least one pantry)
 *   - GetPantry (storage locations etc.)
 *   - GetPantryItem (only for edit mode)
 *
 * Matches the production document selections so writeQuery doesn't drop
 * fields silently.
 */
function buildCache(opts: {
  itemId?: string;
  itemFixture?: Parameters<typeof pantryItemData>[0];
}): InMemoryCache {
  const cache = makeCache();

  seedQuery(cache, {
    query: GetHomeDocument,
    variables: { homeId: 'h1' },
    data: {
      __typename: 'Query',
      home: homeDetailNode({
        id: 'h1',
        pantries: [{ id: 'p1', name: 'Main', isDefault: true }],
      }),
    },
  });

  seedQuery(cache, {
    query: GetPantryDocument,
    variables: {
      id: 'p1',
      itemsFirst: 50,
      storageLocationsFirst: 20,
      today: todayKey(),
    },
    data: pantryData({ id: 'p1' }),
  });

  if (opts.itemId) {
    seedQuery(cache, {
      query: PantryItemForEditDocument,
      variables: { id: opts.itemId },
      data: pantryItemData({
        id: opts.itemId,
        ...(opts.itemFixture ?? {}),
      }),
    });
  }

  return cache;
}

describe('PantryItemForm — sections', () => {
  // There is no `add` mode any more. It was a second create path nothing could
  // reach: `PantryItem` registers with `linking: null` and both callers of
  // `toPantryItem` pass an itemId, so the form only ever opened on an existing
  // item. Adding goes through `AddToPantrySheet` -> `AddDetailsSheet`.
  it('renders the item information section by default (Basics tab)', async () => {
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    expect(screen.getByText('Item Information')).toBeTruthy();
  });

  it('switches to Inventory tab and shows the quantity section', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('switches to Storage tab and shows the storage details section', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Storage'));
    expect(screen.getByText('Storage Details')).toBeTruthy();
  });

  it("seeds the storage state from a picked location's temperature", async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Storage'));
    expect(screen.getByTestId('storage-state')).toHaveTextContent(
      'REFRIGERATED',
    );

    await user.press(screen.getByTestId('pick-frozen-location'));

    expect(screen.getByTestId('storage-state')).toHaveTextContent('FROZEN');
  });
});

describe('PantryItemForm — edit mode', () => {
  it('renders the edit-mode title once the item loads', async () => {
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({
        itemId: 'item-1',
        itemFixture: { itemName: 'Flour' },
      }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  it('shows the edit modal testID when item exists', async () => {
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByTestId('edit-pantry-item-modal')).toBeTruthy();
  });

  it('shows "Item not found", still closable, when the item query returns null', async () => {
    renderWithApollo(<PantryItemForm itemId="missing" />, {
      cache: buildCache({}),
      operationMocks: [
        recordMock(PantryItemForEditDocument, {
          data: { __typename: 'Query', pantryItem: null },
        }).mock,
      ],
    });
    await drainTimers();
    expect(screen.getByText('Item not found')).toBeTruthy();
    // The form's header — and so its close control — stays up.
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
  });

  // The form's fields are cached before the query is: it renders at once, then
  // the server's answer re-seeds it. Re-seeding during render updated every
  // mounted field subscriber mid-render, which React refuses.
  it('re-seeds from a late server answer without updating a field mid-render', async () => {
    const cache = buildCache({});
    seedFragment(cache, {
      fragment: PantryItemForm_PantryItemFragmentDoc,
      fragmentName: 'PantryItemForm_pantryItem',
      data: pantryItemData({ id: 'item-1', itemName: 'Flour' }).pantryItem,
    });
    const answer = recordMock(PantryItemForEditDocument, {
      data: { pantryItem: { id: 'item-1', itemName: 'Bread flour' } },
      held: true,
    });
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache,
      operationMocks: [answer.mock],
    });

    await drainTimers();
    expect(screen.getByText('name:Flour')).toBeTruthy();
    answer.release();
    await drainTimers();
    expect(screen.getByText('name:Bread flour')).toBeTruthy();
    const renderPhaseUpdates = jest
      .mocked(console.error)
      .mock.calls.filter(([message]) =>
        String(message).includes('Cannot update a component'),
      );
    expect(renderPhaseUpdates).toEqual([]);
  });

  // The first open from the pantry list: the row is cached, the form's fields
  // are not, so the item arrives only once the query answers.
  it('renders the item once the query fills a cache that missed on mount', async () => {
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({}),
      operationMocks: [
        recordMock(PantryItemForEditDocument, {
          data: { pantryItem: { id: 'item-1' } },
        }).mock,
      ],
    });
    await drainTimers();
    expect(screen.getByText('Item Information')).toBeTruthy();
    expect(screen.queryByText('Item not found')).toBeNull();
  });

  it('renders the Inventory tab with quantity section in edit mode', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByText('Quantity')).toBeTruthy();
  });
});

describe('PantryItemForm — quantity seeds', () => {
  it('seeds the fraction field with a cooking fraction and the decimal-pad fields rounded to three decimals', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({
        itemId: 'item-1',
        itemFixture: {
          quantity: 1.33333334,
          minQuantity: 0.33333334,
          restockQuantity: 177.4412,
        },
      }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByText('seeded:1 1/3|0.333|177.441')).toBeTruthy();
  });
});

describe('PantryItemForm — page navigation', () => {
  it('renders all four pages on the PageIndicator', async () => {
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Product')).toBeTruthy();
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Inventory')).toBeTruthy();
  });
});

describe('PantryItemForm — net weight', () => {
  it('clears the unit refusal once a unit is picked', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Product'));

    await user.type(screen.getByPlaceholderText('e.g., 14.5'), '1');
    await drainTimers();
    expect(
      screen.getByText('Please select a unit for the net weight.'),
    ).toBeTruthy();

    await user.press(screen.getByTestId('pick-unit'));
    expect(
      screen.queryByText('Please select a unit for the net weight.'),
    ).toBeNull();
  });
});

// The size opens as the detail reads it, so what is saved is what was typed.
describe('PantryItemForm — package size in the user’s units', () => {
  type Stack = NonNullable<
    QueryDataFor<typeof PantryItemForEditDocument>['pantryItem']
  >;
  type Reading = NonNullable<Stack['packageSize']>['metric'];

  const reading = (value: number, id: string, symbol: string): Reading =>
    readingAsAbbreviation({
      __typename: 'MeasureReading',
      value,
      unitId: id,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });

  // A 3 LB honey whose size the stack stores as 1360.78 g.
  const renderHoney = (system: UnitSystem, trackingUnitId?: string) => {
    const cache = buildCache({});
    const data = pantryItemData({ id: 'item-1' });
    const stack = data.pantryItem;
    if (!stack) throw new Error('fixture has no item');
    stack.netWeight = 1360.78;
    stack.netWeightUnit = asAbbreviation({
      __typename: 'Unit',
      id: 'unit-g',
      name: 'gram',
      symbol: 'g',
    });
    stack.packageSize = {
      __typename: 'Measure',
      value: 1360.78,
      unitId: 'unit-g',
      metric: reading(1.36, 'unit-kg', 'kg'),
      imperial: reading(3, 'unit-lb', 'lb'),
    };
    if (trackingUnitId) stack.unit = { ...stack.unit, id: trackingUnitId };
    seedQuery(cache, {
      query: PantryItemForEditDocument,
      variables: { id: 'item-1' },
      data,
    });
    writeUnitSystemSettings(cache, system, system);
    renderWithApollo(<PantryItemForm itemId="item-1" />, { cache });
  };

  const openProduct = async () => {
    const user = userEvent.setup();
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Product'));
  };

  it.each([
    [UnitSystem.Imperial, '3', 'lb'],
    [UnitSystem.Metric, '1.36', 'kg'],
  ])('opens a %s user on %s %s', async (system, value, unit) => {
    renderHoney(system);
    await openProduct();
    expect(screen.getByPlaceholderText('e.g., 14.5').props.value).toBe(value);
    expect(screen.getByText(`unit:${unit}`)).toBeTruthy();
  });

  it('opens on the stored figure where the reading is the tracking unit', async () => {
    renderHoney(UnitSystem.Imperial, 'unit-lb');
    await openProduct();
    expect(screen.getByPlaceholderText('e.g., 14.5').props.value).toBe(
      '1360.78',
    );
    expect(screen.getByText('unit:g')).toBeTruthy();
  });
});

describe('PantryItemForm — the unit it is used in', () => {
  it('opens on the stack’s, so it can be changed or cleared', async () => {
    const cache = buildCache({});
    const data = pantryItemData({ id: 'item-1' });
    const stack = data.pantryItem;
    if (!stack) throw new Error('fixture has no item');
    stack.consumeUnit = asAbbreviation({
      __typename: 'Unit',
      id: 'unit-tbsp',
      name: 'tablespoon',
      symbol: 'tbsp',
    });
    seedQuery(cache, {
      query: PantryItemForEditDocument,
      variables: { id: 'item-1' },
      data,
    });
    renderWithApollo(<PantryItemForm itemId="item-1" />, { cache });

    const user = userEvent.setup();
    await drainTimers();
    expect(screen.getByText('Edit Pantry Item')).toBeTruthy();
    await user.press(screen.getByText('Product'));

    expect(screen.getByText('Used in')).toBeTruthy();
    expect(screen.getByText('unit:tbsp')).toBeTruthy();
  });
});
