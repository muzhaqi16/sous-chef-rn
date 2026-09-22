'use no memo';

import { toDateKey } from '#/utils/dateUtils';
import React from 'react';
import { makeCache } from '#/apollo/cache';
import type { InMemoryCache } from '@apollo/client';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { homeDetailNode } from '#/test-utils/fixtures/homeFixtures';
import { pantryData } from '#/test-utils/fixtures/pantryFixtures';
import { pantryItemData } from '#/test-utils/fixtures/pantryItemFixtures';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { PantryItemForm } from '../PantryItemForm';

/**
 * The quantity field through the real `QuantitySection` and `FractionInput`:
 * text the submit cannot parse is reported on the field, not in an alert after
 * Save, and correcting it lets the save through.
 */

const mockUpdateQuantity = jest.fn();

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

jest.mock('#features/pantry/hooks/mutations/useUpdatePantryItem', () => ({
  useUpdatePantryItem: jest.fn(() => ({ updatePantryItemFields: jest.fn() })),
}));
jest.mock(
  '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity',
  () => ({
    useUpdatePantryItemQuantity: jest.fn(() => ({
      updateQuantity: mockUpdateQuantity,
    })),
  }),
);
jest.mock('#features/pantry/hooks/mutations/useResolveUnit', () => ({
  useResolveUnit: jest.fn(() => ({ resolveUnitId: jest.fn() })),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({
    rightActions,
  }: {
    rightActions?: { testID?: string; onPress: () => void }[];
  }) => {
    const { Pressable, View } = require('react-native');
    return (
      <View>
        {rightActions?.map(action => (
          <Pressable
            key={action.testID}
            testID={action.testID}
            onPress={action.onPress}
          />
        ))}
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
      <View>
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
  CollapsibleSection: () => null,
}));

jest.mock('../ItemInformationSection', () => ({
  ItemInformationSection: () => null,
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

beforeEach(() => {
  jest.clearAllMocks();
});

function buildCache(): InMemoryCache {
  const cache = makeCache();
  cache.writeQuery({
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
  cache.writeQuery({
    query: GetPantryDocument,
    variables: {
      id: 'p1',
      itemsFirst: 50,
      storageLocationsFirst: 20,
      today: toDateKey(new Date()),
    },
    data: pantryData({ id: 'p1' }),
  });
  cache.writeQuery({
    query: GetPantryItemDocument,
    variables: { id: 'item-1' },
    data: pantryItemData({ id: 'item-1', quantity: 5 }),
  });
  return cache;
}

describe('PantryItemForm — the quantity field', () => {
  it('reports unreadable text on the field, and a corrected value clears it and saves', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryItemForm itemId="item-1" />, {
      cache: buildCache(),
    });
    await user.press(await screen.findByText('Inventory'));

    const field = screen.getByTestId(pantryTestIDs.editItemQuantityInput);
    await user.clear(field);
    await user.type(field, 'abc');

    expect(await screen.findByText(t('errors.invalidQuantity'))).toBeTruthy();

    await user.clear(field);
    await user.type(field, '2');

    await waitFor(() =>
      expect(screen.queryByText(t('errors.invalidQuantity'))).toBeNull(),
    );

    await user.press(screen.getByTestId(pantryTestIDs.editItemSubmitButton));

    await waitFor(() =>
      expect(mockUpdateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'item-1',
          quantityInput: '2',
          quantityValue: 2,
        }),
      ),
    );
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});
