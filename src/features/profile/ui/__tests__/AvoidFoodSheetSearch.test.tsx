'use no memo';

import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
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
import {
  CommonlyAvoidedFoodsDocument,
  SearchAvoidableFoodsDocument,
} from '#features/profile/ui/useAvoidFoodSearch.generated';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
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

const BACON = { id: 'bacon', name: 'Bacon' };
const TURKEY_BACON = { id: 'turkey-bacon', name: 'Turkey Bacon' };

const searchMock = (foods: Array<{ id: string; name: string }>) =>
  recordMock(SearchAvoidableFoodsDocument, {
    data: { searchItems: { edges: foods.map(node => ({ node })) } },
  });

const MILK = { id: 'milk', name: 'Milk' };
const PEANUTS = { id: 'peanuts', name: 'Peanuts' };

const suggestedMock = (foods: Array<{ id: string; name: string }>) =>
  recordMock(CommonlyAvoidedFoodsDocument, {
    data: { items: { edges: foods.map(node => ({ node })) } },
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
  });
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AvoidFoodSheet search', () => {
  it('lists nothing and asks nothing for an empty or short term', async () => {
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
    await drainTimers();

    expect(row(BACON.id)).toBeTruthy();
    expect(screen.getByText('Bacon')).toBeTruthy();
    expect(screen.getByText('Turkey Bacon')).toBeTruthy();
    expect(search.fired).toEqual([expect.objectContaining({ query: 'bac' })]);
    expect(searchFilters()).toEqual({ level: 'CONCEPT', visibility: 'PUBLIC' });
  });

  it('says when nothing matched', async () => {
    renderWithApollo(sheet(true), { operationMocks: [searchMock([]).mock] });

    type('zzz');
    await drainTimers();

    expect(
      screen.getByText(t('empty.noResultsFor', { query: 'zzz' })),
    ).toBeTruthy();
  });

  it('lists nothing once the search is cleared', async () => {
    renderWithApollo(sheet(true), {
      operationMocks: [searchMock([BACON]).mock],
    });

    type('bacon');
    await drainTimers();
    expect(row(BACON.id)).toBeTruthy();

    type('');
    await drainTimers();

    expect(row(BACON.id)).toBeNull();
  });

  it('lists nothing when opened again after a search', async () => {
    const { rerender } = renderWithApollo(sheet(true), {
      operationMocks: [searchMock([BACON]).mock],
    });

    type('bacon');
    await drainTimers();
    expect(row(BACON.id)).toBeTruthy();

    rerender(sheet(false));
    rerender(sheet(true));

    expect(row(BACON.id)).toBeNull();
  });

  it('says the search needs a connection while offline, and asks nothing', async () => {
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

  describe('with nothing typed', () => {
    it('lists the foods people commonly avoid, and a tap picks one', async () => {
      const onPick = jest.fn(() => Promise.resolve(true));
      renderWithApollo(
        <AvoidFoodSheet visible onDismiss={jest.fn()} onPick={onPick} />,
        { operationMocks: [suggestedMock([MILK, PEANUTS]).mock] },
      );
      await drainTimers();

      expect(
        screen.getByText(t('dietaryProfile.avoidSuggestionsTitle')),
      ).toBeTruthy();
      expect(row(MILK.id)).toBeTruthy();
      expect(row(PEANUTS.id)).toBeTruthy();

      fireEvent.press(screen.getByText('Milk'));
      await drainTimers();

      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ id: MILK.id, name: 'Milk' }),
        RestrictionSeverity.Preference,
      );
    });

    it('leaves out a food already avoided', async () => {
      renderWithApollo(
        <AvoidFoodSheet
          visible
          onDismiss={jest.fn()}
          avoided={new Set([MILK.id])}
          onPick={jest.fn()}
        />,
        { operationMocks: [suggestedMock([MILK, PEANUTS]).mock] },
      );
      await drainTimers();

      expect(row(MILK.id)).toBeNull();
      expect(row(PEANUTS.id)).toBeTruthy();
    });

    it('gives way to the results once a search is typed', async () => {
      renderWithApollo(sheet(true), {
        operationMocks: [
          suggestedMock([MILK, PEANUTS]).mock,
          searchMock([BACON]).mock,
        ],
      });
      await drainTimers();
      expect(row(MILK.id)).toBeTruthy();

      type('bac');
      await drainTimers();

      expect(row(MILK.id)).toBeNull();
      expect(
        screen.queryByText(t('dietaryProfile.avoidSuggestionsTitle')),
      ).toBeNull();
      expect(row(BACON.id)).toBeTruthy();
    });

    it('shows no title while the list is empty', async () => {
      renderWithApollo(sheet(true), {
        operationMocks: [suggestedMock([]).mock],
      });
      await drainTimers();

      expect(
        screen.queryByText(t('dietaryProfile.avoidSuggestionsTitle')),
      ).toBeNull();
    });

    it('asks for nothing while the sheet is closed or the device is offline', async () => {
      const suggested = suggestedMock([MILK]);
      const { rerender } = renderWithApollo(sheet(false), {
        operationMocks: [suggested.mock],
      });
      await drainTimers();
      expect(suggested.fired).toEqual([]);

      storeApi.setState({ isOnline: false, apiReachable: null });
      rerender(sheet(true));
      await drainTimers();

      expect(suggested.fired).toEqual([]);
      expect(row(MILK.id)).toBeNull();
      expect(
        screen.getByText(t('dietaryProfile.avoidSearchNeedsConnection')),
      ).toBeTruthy();
    });
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
    await drainTimers();

    expect(screen.getByText(t('errors.codes.rateLimitExceeded'))).toBeTruthy();
  });
});
