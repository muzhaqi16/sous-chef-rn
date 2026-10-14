import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CreateOutcome } from '#/graphql/generated/schemaTypes';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { useStore } from '#store';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StoreAutocompleteField } from '../StoreAutocompleteField';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');
// Spied, not replaced: the picker's `visible` is what the person sees, and the
// gorhom mock renders the sheet's content whether it is presented or not.
jest.mock('#hooks/useStandardBottomSheet', () => {
  const actual = jest.requireActual<
    typeof import('#hooks/useStandardBottomSheet')
  >('#hooks/useStandardBottomSheet');
  return {
    ...actual,
    useStandardBottomSheet: jest.fn(actual.useStandardBottomSheet),
  };
});

const pickerVisible = () =>
  jest.mocked(useStandardBottomSheet).mock.calls.at(-1)?.[0].visible;

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

/** Answers the store search for `term` only, after `delay` ms when given. */
const searchFor = (
  term: string,
  stores: MockDataFor<typeof SearchStoresDocument>,
  delay?: number,
): RecordedMock =>
  recordMock(SearchStoresDocument, {
    data: stores,
    delay,
    match: vars => vars.search === term,
  });

const created = recordMock(CreateStoreDocument, {
  dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
    createStore: {
      __typename: 'CreateStorePayload',
      outcome: CreateOutcome.Created,
      store: {
        id: String(inputOf(vars).id),
        name: String(inputOf(vars).name),
        address: null,
      },
    },
  }),
});

function renderField(variant: 'inline' | 'modal', ...searches: RecordedMock[]) {
  const onChangeText = jest.fn();
  const onStoreSelected = jest.fn();
  renderWithApollo(
    <StoreAutocompleteField
      variant={variant}
      value=""
      onChangeText={onChangeText}
      onStoreSelected={onStoreSelected}
      testID="store-field"
    />,
    { operationMocks: [...searches.map(s => s.mock), created.mock] },
  );
  return { onChangeText, onStoreSelected };
}

async function expectAddedAndPicked(
  name: string,
  { onChangeText, onStoreSelected }: ReturnType<typeof renderField>,
) {
  await waitFor(() => expect(created.fired).toHaveLength(1));
  const [create] = created.fired;
  const id = String(inputOf(create ?? {}).id);
  expect(create).toEqual({ input: { id, name } });
  await waitFor(() =>
    expect(onStoreSelected).toHaveBeenLastCalledWith(id, name),
  );
  expect(onChangeText).toHaveBeenLastCalledWith(name);
}

beforeEach(() => {
  created.fired.length = 0;
  useStore.setState({ isOnline: true, cachedStores: [] });
});

describe('StoreAutocompleteField', () => {
  it('offers a name no store has, adds it as the pick and closes', async () => {
    // A blank term lists the warmed stores, so a list left open shows this one.
    useStore.setState({
      cachedStores: [{ id: 'cached-1', name: 'Corner Grocer', address: null }],
    });
    const field = renderField('inline', searchFor('East End', found()));

    fireEvent.changeText(screen.getByTestId('store-field'), 'East End');
    fireEvent.press(await screen.findByText('Add East End'));

    await expectAddedAndPicked('East End', field);
    expect(screen.queryByText('Corner Grocer')).toBeNull();
  });

  // The inline list shows 6 rows; the offer sits outside that cut.
  it('offers the name past a full list of similar stores', async () => {
    const field = renderField(
      'inline',
      searchFor(
        'Fresh Market',
        found(
          'Fresh Market East',
          'Fresh Market West',
          'Fresh Market North',
          'Fresh Market South',
          'Fresh Market Plaza',
          'Fresh Market Downtown',
          'Fresh Market Uptown',
          'Fresh Market Express',
        ),
      ),
    );

    fireEvent.changeText(screen.getByTestId('store-field'), 'Fresh Market');
    expect(await screen.findByText('Fresh Market East')).toBeTruthy();
    expect(screen.queryByText('Fresh Market Express')).toBeNull();
    fireEvent.press(screen.getByText('Add Fresh Market'));

    await expectAddedAndPicked('Fresh Market', field);
  });

  it('offers no new store when one of that name is listed', async () => {
    renderField('inline', searchFor('east end', found('East End')));

    fireEvent.changeText(screen.getByTestId('store-field'), 'east end');

    expect(await screen.findByText('East End')).toBeTruthy();
    expect(screen.queryByText(/^Add /)).toBeNull();
  });

  it('offers nothing while the search for the typed name runs', async () => {
    const running = searchFor('East End', found(), Infinity);
    renderField('inline', searchFor('Ea', found('Eastgate')), running);
    const input = screen.getByTestId('store-field');

    fireEvent.changeText(input, 'Ea');
    expect(await screen.findByText('Eastgate')).toBeTruthy();
    fireEvent.changeText(input, 'East End');
    await waitFor(() => expect(running.fired).toHaveLength(1));

    // The held rows stay while the new search runs, with no offer under them.
    expect(screen.getByText('Eastgate')).toBeTruthy();
    expect(screen.queryByText(/^Add /)).toBeNull();
  });

  it('opens the picker on the offer alone, and closes it on the add', async () => {
    const field = renderField('modal', searchFor('East End', found()));

    fireEvent.changeText(screen.getByTestId('store-field'), 'East End');
    const offer = await screen.findByText('Add East End');
    expect(pickerVisible()).toBe(true);
    fireEvent.press(offer);

    await expectAddedAndPicked('East End', field);
    expect(pickerVisible()).toBe(false);
  });
});
