'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { AutocompleteItemsDocument } from '#operations/item/item.generated';
import {
  ItemLevel,
  ItemType,
  type ItemSuggestion,
} from '#/graphql/generated/schemaTypes';
import { storeApi } from '#store';
import { profileTestIDs } from '#features/profile/testIDs';
import { AvoidFoodSheet } from '../AvoidFoodSheet';

jest.mock('#hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const suggestion = (
  id: string,
  name: string,
  level: ItemLevel,
): ItemSuggestion => ({
  __typename: 'ItemSuggestion',
  id,
  name,
  type: ItemType.Food,
  level,
  brands: [],
  category: null,
  defaultUnit: null,
  displayUnit: null,
  imageUrl: null,
  netWeight: null,
});

const LEMON_JUICE = suggestion('lemon-juice', 'Lemon Juice', ItemLevel.Concept);
const LEMONADE = suggestion(
  'lemonade-lemon-juice',
  'Lemonade Lemon Juice',
  ItemLevel.Product,
);

const autocompleteMock: MockFor<typeof AutocompleteItemsDocument> = {
  request: { query: AutocompleteItemsDocument, variables: () => true },
  maxUsageCount: Number.POSITIVE_INFINITY,
  result: {
    data: {
      autocompleteItems: {
        totalCount: 2,
        suggestions: [LEMON_JUICE, LEMONADE],
      },
    },
  },
};

const sheet = (visible: boolean) => (
  <AvoidFoodSheet visible={visible} onDismiss={jest.fn()} onPick={jest.fn()} />
);

const searchField = () => screen.getByTestId(profileTestIDs.avoidSearchInput);
const lemonRow = () =>
  screen.queryByTestId(profileTestIDs.avoidCandidate(LEMON_JUICE.id));

beforeEach(() => {
  storeApi.setState({ cachedItemSuggestions: [] });
});

describe('AvoidFoodSheet with an empty search field', () => {
  it('lists nothing on open, though earlier searches filled the seen-items cache', () => {
    storeApi.setState({ cachedItemSuggestions: [LEMON_JUICE, LEMONADE] });

    renderWithApollo(sheet(true), { operationMocks: [autocompleteMock] });

    expect(lemonRow()).toBeNull();
    expect(
      screen.queryByTestId(profileTestIDs.avoidCandidate(LEMONADE.id)),
    ).toBeNull();
  });

  it('lists nothing once the search is cleared', async () => {
    renderWithApollo(sheet(true), { operationMocks: [autocompleteMock] });

    fireEvent.changeText(searchField(), 'lemon juice');
    await waitFor(() => expect(lemonRow()).not.toBeNull());

    fireEvent.changeText(searchField(), '');
    await waitFor(() => expect(lemonRow()).toBeNull());
  });

  it('lists nothing when opened again after a search', async () => {
    const { rerender } = renderWithApollo(sheet(true), {
      operationMocks: [autocompleteMock],
    });

    fireEvent.changeText(searchField(), 'lemon juice');
    await waitFor(() => expect(lemonRow()).not.toBeNull());

    rerender(sheet(false));
    rerender(sheet(true));

    expect(lemonRow()).toBeNull();
  });
});
