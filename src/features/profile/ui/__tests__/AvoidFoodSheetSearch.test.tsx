'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GraphQLError, Kind, valueFromASTUntyped, visit } from 'graphql';
import {
  recordMock,
  renderWithApollo,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { t } from '#/i18n';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { storeApi } from '#store';
import { profileTestIDs } from '#features/profile/testIDs';
import { SearchAvoidableFoodsDocument } from '#features/profile/ui/useAvoidFoodSearch.generated';
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

// The field reports once typing pauses: a row arrives only after that wait.
const ARRIVES = { timeout: 3000 };

const BACON = { id: 'bacon', name: 'Bacon' };
const TURKEY_BACON = { id: 'turkey-bacon', name: 'Turkey Bacon' };

const searchMock = (foods: Array<{ id: string; name: string }>) =>
  recordMock(SearchAvoidableFoodsDocument, {
    data: { searchItems: { edges: foods.map(node => ({ node })) } },
  });

const sheet = (visible: boolean) => (
  <AvoidFoodSheet visible={visible} onDismiss={jest.fn()} onPick={jest.fn()} />
);

const type = (text: string) => {
  fireEvent.changeText(
    screen.getByTestId(profileTestIDs.avoidSearchInput),
    text,
  );
};
const row = (id: string) =>
  screen.queryByTestId(profileTestIDs.avoidCandidate(id));
const findRow = (id: string) =>
  screen.findByTestId(profileTestIDs.avoidCandidate(id), {}, ARRIVES);

/** The `filters` the document sends `searchItems`, as plain values. */
const searchFilters = () => {
  let filters: unknown;
  visit(SearchAvoidableFoodsDocument, {
    Field(field) {
      if (field.name.value !== 'searchItems') return;
      const argument = field.arguments?.find(
        arg => arg.name.value === 'filters',
      );
      if (argument?.value.kind === Kind.OBJECT) {
        filters = valueFromASTUntyped(argument.value);
      }
    },
  });
  return filters;
};

beforeEach(() => {
  storeApi.setState({
    isOnline: true,
    apiReachable: null,
    offlineModeEnabled: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AvoidFoodSheet search', () => {
  it('lists nothing and asks nothing for an empty or short term', async () => {
    jest.useFakeTimers();
    const search = searchMock([BACON]);
    renderWithApollo(sheet(true), { operationMocks: [search.mock] });

    expect(row(BACON.id)).toBeNull();

    // Three characters only before the API trims it.
    type('  ba  ');
    await drainTimers();

    expect(search.fired).toEqual([]);
    expect(row(BACON.id)).toBeNull();
    expect(
      screen.queryByText(t('empty.noResultsFor', { query: 'ba' })),
    ).toBeNull();
  });

  it('searches public foods only, never products, from three characters', async () => {
    const search = searchMock([BACON, TURKEY_BACON]);
    renderWithApollo(sheet(true), { operationMocks: [search.mock] });

    type('bac');

    await findRow(BACON.id);
    expect(screen.getByText('Bacon')).toBeTruthy();
    expect(screen.getByText('Turkey Bacon')).toBeTruthy();
    expect(search.fired).toEqual([expect.objectContaining({ query: 'bac' })]);
    expect(searchFilters()).toEqual({ level: 'CONCEPT', visibility: 'PUBLIC' });
  });

  it('says when nothing matched', async () => {
    renderWithApollo(sheet(true), { operationMocks: [searchMock([]).mock] });

    type('zzz');

    expect(
      await screen.findByText(
        t('empty.noResultsFor', { query: 'zzz' }),
        {},
        ARRIVES,
      ),
    ).toBeTruthy();
  });

  it('lists nothing once the search is cleared', async () => {
    renderWithApollo(sheet(true), {
      operationMocks: [searchMock([BACON]).mock],
    });

    type('bacon');
    await findRow(BACON.id);

    type('');
    await waitFor(() => expect(row(BACON.id)).toBeNull(), ARRIVES);
  });

  it('lists nothing when opened again after a search', async () => {
    const { rerender } = renderWithApollo(sheet(true), {
      operationMocks: [searchMock([BACON]).mock],
    });

    type('bacon');
    await findRow(BACON.id);

    rerender(sheet(false));
    rerender(sheet(true));

    expect(row(BACON.id)).toBeNull();
  });

  it('says the search needs a connection while offline, and asks nothing', async () => {
    jest.useFakeTimers();
    storeApi.setState({ isOnline: false, apiReachable: null });
    const search = searchMock([BACON]);
    renderWithApollo(sheet(true), { operationMocks: [search.mock] });

    expect(
      screen.getByText(t('dietaryProfile.avoidSearchNeedsConnection')),
    ).toBeTruthy();

    type('bacon');
    await drainTimers();

    expect(search.fired).toEqual([]);
    expect(row(BACON.id)).toBeNull();
    expect(screen.getByTestId(profileTestIDs.avoidSearchInput)).toBeTruthy();
  });

  it('says why a search failed', async () => {
    const throttled: MockFor<typeof SearchAvoidableFoodsDocument> = {
      request: { query: SearchAvoidableFoodsDocument, variables: () => true },
      result: {
        errors: [
          new GraphQLError('Too many requests', {
            extensions: { code: TopLevelErrorCode.OperationRateLimited },
          }),
        ],
      },
    };
    renderWithApollo(sheet(true), { operationMocks: [throttled] });

    type('bacon');

    expect(
      await screen.findByText(t('errors.codes.rateLimitExceeded'), {}, ARRIVES),
    ).toBeTruthy();
  });
});
