import React from 'react';
import { screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { PantryEmptyState } from '../PantryEmptyState';

const renderEmpty = (state: { noPantries: boolean; pantriesHidden: boolean }) =>
  renderWithApollo(
    <PantryEmptyState
      showSkeletons={false}
      searchQuery=""
      itemCount={0}
      locationFilter="all"
      tabs={[]}
      overallItemCount={0}
      onCreatePantry={jest.fn()}
      {...state}
    />,
  );

describe('PantryEmptyState offline', () => {
  const renderNarrowed = (props: {
    searchQuery?: string;
    locationFilter?: 'all' | string;
    mayHoldMore: boolean;
  }) =>
    renderWithApollo(
      <PantryEmptyState
        showSkeletons={false}
        searchQuery=""
        itemCount={0}
        locationFilter="all"
        tabs={[]}
        overallItemCount={3}
        onRetryHeld={jest.fn()}
        {...props}
      />,
    );

  beforeEach(() => {
    useStore.setState({ isOnline: false, apiReachable: null });
  });

  afterEach(() => {
    useStore.setState({ isOnline: true, apiReachable: null });
  });

  it('says a wider search needs a connection while rows are unheld', () => {
    renderNarrowed({ searchQuery: 'kale', mayHoldMore: true });

    expect(
      screen.getByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeTruthy();
    expect(
      screen.getByText(t('empty.widerSearchNeedsConnection')),
    ).toBeTruthy();
    expect(
      screen.queryByText(t('empty.noResultsFor', { query: 'kale' })),
    ).toBeNull();
  });

  it('says no results when the device holds every row', () => {
    renderNarrowed({ searchQuery: 'kale', mayHoldMore: false });

    expect(
      screen.getByText(t('empty.noResultsFor', { query: 'kale' })),
    ).toBeTruthy();
  });

  it('never calls a tab empty while its rows may be unheld', () => {
    renderNarrowed({ locationFilter: 'fridge', mayHoldMore: true });

    expect(screen.getByTestId('state-offline')).toBeTruthy();
  });
});

describe('PantryEmptyState', () => {
  it('invites creating a pantry when the home has none', () => {
    renderEmpty({ noPantries: true, pantriesHidden: false });

    expect(screen.getByText(t('pantryScreen.noPantriesTitle'))).toBeTruthy();
    expect(screen.getByText(t('pantryScreen.noPantriesAction'))).toBeTruthy();
  });

  // The API lists no pantry to a member whose pantry view is off: the home
  // has them, so offering to create one would mislead.
  it('says the pantries are hidden rather than offering to create one', () => {
    renderEmpty({ noPantries: true, pantriesHidden: true });

    expect(
      screen.getByText(t('pantryScreen.pantriesHiddenTitle')),
    ).toBeTruthy();
    expect(screen.queryByText(t('pantryScreen.noPantriesAction'))).toBeNull();
  });
});
