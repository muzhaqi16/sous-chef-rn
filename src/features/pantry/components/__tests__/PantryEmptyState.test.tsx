import React from 'react';
import { screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
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
