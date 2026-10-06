import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CreateOutcome } from '#/graphql/generated/schemaTypes';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { useStore } from '#store';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { StoreAutocompleteField } from '../StoreAutocompleteField';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');

const found = (
  ...names: string[]
): MockDataFor<typeof SearchStoresDocument> => ({
  stores: {
    edges: names.map((name, index) => ({
      node: { id: `store-${index}`, name, address: null },
    })),
    totalCount: names.length,
  },
});

const created = recordMock(CreateStoreDocument, {
  dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
    createStore: {
      __typename: 'CreateStorePayload',
      outcome: CreateOutcome.Created,
      store: { id: String(inputOf(vars).id), name: 'East End', address: null },
    },
  }),
});

function renderField(stores: MockDataFor<typeof SearchStoresDocument>) {
  const onChangeText = jest.fn();
  const onStoreSelected = jest.fn();
  const search = recordMock(SearchStoresDocument, { data: stores });
  renderWithApollo(
    <StoreAutocompleteField
      variant="inline"
      value=""
      onChangeText={onChangeText}
      onStoreSelected={onStoreSelected}
      testID="store-field"
    />,
    { operationMocks: [search.mock, created.mock] },
  );
  return { onChangeText, onStoreSelected };
}

beforeEach(() => {
  useStore.setState({ isOnline: true });
});

describe('StoreAutocompleteField', () => {
  it('offers a name no store has, and adds it as the pick', async () => {
    const { onChangeText, onStoreSelected } = renderField(found());

    fireEvent.changeText(screen.getByTestId('store-field'), 'East End');
    fireEvent.press(await screen.findByText('Add "East End"'));

    await waitFor(() => expect(created.fired).toHaveLength(1));
    const [create] = created.fired;
    const id = String(inputOf(create ?? {}).id);
    expect(create).toEqual({ input: { id, name: 'East End' } });
    await waitFor(() =>
      expect(onStoreSelected).toHaveBeenLastCalledWith(id, 'East End'),
    );
    expect(onChangeText).toHaveBeenLastCalledWith('East End');
  });

  it('offers no new store when one of that name is listed', async () => {
    renderField(found('East End'));

    fireEvent.changeText(screen.getByTestId('store-field'), 'east end');

    expect(await screen.findByText('East End')).toBeTruthy();
    expect(screen.queryByText('Add "east end"')).toBeNull();
  });
});
