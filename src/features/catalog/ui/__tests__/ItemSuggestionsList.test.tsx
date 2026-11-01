import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { ItemSuggestionsList } from '../ItemSuggestionsList';

const renderEmptyList = () =>
  render(
    <ItemSuggestionsList
      searchQuery="kale"
      suggestions={[]}
      addManuallyPosition="bottom"
      testIDPrefix="test"
      onAddManually={jest.fn()}
      onSelectSuggestion={jest.fn()}
    />,
  );

describe('ItemSuggestionsList with no match', () => {
  afterEach(() => {
    useStore.setState({ isOnline: true, apiReachable: null });
  });

  it('says there are no matches online', () => {
    renderEmptyList();

    expect(
      screen.getByText(
        t('addItemSheet.noMatchesAddManually', { term: 'kale' }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeNull();
  });

  it('says a wider search needs a connection offline, and still offers adding it', () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    renderEmptyList();

    expect(
      screen.getByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeTruthy();
    expect(
      screen.getByText(t('empty.widerSearchNeedsConnection')),
    ).toBeTruthy();
    expect(
      screen.getByText(t('addItemSheet.addManuallyWithTerm', { term: 'kale' })),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        t('addItemSheet.noMatchesAddManually', { term: 'kale' }),
      ),
    ).toBeNull();
  });
});
