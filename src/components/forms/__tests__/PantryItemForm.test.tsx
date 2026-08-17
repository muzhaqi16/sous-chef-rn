'use no memo';

import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { screen, userEvent } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
  type GetPantryItemQuery,
} from '#features/pantry/graphql/pantry.generated';
import { homeNode } from '../../../../__tests__/helpers/fixtures/homeFixtures';
import { pantryData } from '../../../../__tests__/helpers/fixtures/pantryFixtures';
import { pantryItemData } from '../../../../__tests__/helpers/fixtures/pantryItemFixtures';
import { PantryItemForm } from '../PantryItemForm';

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
  useSelectedPantryId: jest.fn(() => 'p1'),
  useSelectedHomeId: jest.fn(() => 'h1'),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/iconUtils', () => ({
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
jest.mock('#features/pantry/hooks/mutations/useCreatePantryItem', () => ({
  useCreatePantryItem: jest.fn(() => ({ createPantryItem: jest.fn() })),
}));
jest.mock('#features/pantry/hooks/mutations/useUpdatePantryItem', () => ({
  useUpdatePantryItem: jest.fn(() => ({ updatePantryItemFields: jest.fn() })),
}));
jest.mock(
  '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity',
  () => ({
    useUpdatePantryItemQuantity: jest.fn(() => ({ updateQuantity: jest.fn() })),
  }),
);
jest.mock('#features/pantry/hooks/mutations/useResolveUnit', () => ({
  useResolveUnit: jest.fn(() => ({ resolveUnitId: jest.fn() })),
}));

jest.mock('#features/pantry/hooks/mutations/types', () => ({
  emptyUnitSelection: { id: null, name: null, symbol: null, type: null },
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => parseFloat(input) || 0),
}));

jest.mock('#/utils/finallyHelpers');

// Form sub-sections — exercised via their own focused tests.
jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({
    label,
    placeholder,
  }: {
    label?: string;
    placeholder?: string;
  }) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput placeholder={placeholder} />
      </View>
    );
  },
}));

jest.mock(
  '#components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    UnitAutocompleteField: ({ label }: { label?: string }) => {
      const { Text, View } = require('react-native');
      return (
        <View testID="unit-autocomplete">
          {label ? <Text>{label}</Text> : null}
        </View>
      );
    },
  }),
);

jest.mock('#components/molecules/Header', () => ({
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

jest.mock('#components/molecules/FieldRow', () => ({
  FieldRow: ({ children }: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('../ItemInformationSection', () => ({
  ItemInformationSection: ({ mode }: { mode: 'add' | 'edit' }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="item-information-section">
        <Text>{`Item Information (${mode})`}</Text>
      </View>
    );
  },
}));

jest.mock('../QuantitySection', () => ({
  QuantitySection: ({
    mode,
    testID,
  }: {
    mode: 'add' | 'edit';
    testID?: string;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={testID || 'quantity-section'}>
        <Text>{`Quantity (${mode})`}</Text>
      </View>
    );
  },
}));

jest.mock('../StorageDetailsSection', () => ({
  StorageDetailsSection: ({ mode }: { mode: 'add' | 'edit' }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="storage-details-section">
        <Text>{`Storage Details (${mode})`}</Text>
      </View>
    );
  },
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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
  const cache = new InMemoryCache();

  cache.writeQuery({
    query: GetHomeDocument,
    variables: { homeId: 'h1' },
    data: {
      __typename: 'Query',
      home: homeNode({
        id: 'h1',
        pantries: [{ id: 'p1', name: 'Main', isDefault: true }],
      }),
    },
  });

  cache.writeQuery({
    query: GetPantryDocument,
    variables: { id: 'p1', itemsFirst: 50, storageLocationsFirst: 20 },
    data: pantryData({ id: 'p1' }),
  });

  if (opts.itemId) {
    cache.writeQuery({
      query: GetPantryItemDocument,
      variables: { id: opts.itemId },
      data: pantryItemData({
        id: opts.itemId,
        ...(opts.itemFixture ?? {}),
      }),
    });
  }

  return cache;
}

describe('PantryItemForm — add mode', () => {
  it('renders the add-mode title and modal testID', () => {
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    expect(screen.getByText('Add Pantry Item')).toBeTruthy();
    expect(screen.getByTestId('add-pantry-item-modal')).toBeTruthy();
  });

  it('renders the item information section by default (Basics tab)', () => {
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    expect(screen.getByText('Item Information (add)')).toBeTruthy();
  });

  it('switches to Inventory tab and shows the quantity section', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByText('Quantity (add)')).toBeTruthy();
  });

  it('switches to Storage tab and shows the storage details section', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    await user.press(screen.getByText('Storage'));
    expect(screen.getByText('Storage Details (add)')).toBeTruthy();
  });

  it('switches to Product tab and shows the net weight section', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    await user.press(screen.getByText('Product'));
    expect(screen.getAllByText('Net Weight').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render the Tags section in add mode', () => {
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    expect(screen.queryByText('Tags')).toBeNull();
  });
});

describe('PantryItemForm — edit mode', () => {
  it('renders the edit-mode title once the item loads', async () => {
    renderWithApollo(<PantryItemForm mode="edit" itemId="item-1" />, {
      cache: buildCache({
        itemId: 'item-1',
        itemFixture: { itemName: 'Flour' },
      }),
    });
    await screen.findByText('Edit Pantry Item');
  });

  it('shows the edit modal testID when item exists', async () => {
    renderWithApollo(<PantryItemForm mode="edit" itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await screen.findByTestId('edit-pantry-item-modal');
  });

  it('shows "Item not found" when the item query returns null', async () => {
    renderWithApollo(<PantryItemForm mode="edit" itemId="missing" />, {
      cache: buildCache({}),
      operationMocks: [
        recordMock<GetPantryItemQuery>(GetPantryItemDocument, {
          data: { __typename: 'Query', pantryItem: null },
        }).mock,
      ],
    });
    await screen.findByText('Item not found');
  });

  it('renders the Inventory tab with quantity section in edit mode', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm mode="edit" itemId="item-1" />, {
      cache: buildCache({ itemId: 'item-1' }),
    });
    await screen.findByText('Edit Pantry Item');
    await user.press(screen.getByText('Inventory'));
    expect(screen.getByText('Quantity (edit)')).toBeTruthy();
  });
});

describe('PantryItemForm — page navigation', () => {
  it('renders all four pages on the PageIndicator', () => {
    renderWithApollo(<PantryItemForm mode="add" />, {
      cache: buildCache({}),
    });
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Product')).toBeTruthy();
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Inventory')).toBeTruthy();
  });
});
