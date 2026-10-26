import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { AddBrandSheet } from '../AddBrandSheet';

const mockAutocomplete = {
  searchTerm: '',
  isLoading: false,
  displayItems: [
    { id: 'b-chips', name: 'ChipCo' },
    { id: 'b-soda', name: 'SodaCo' },
  ],
  handleSearchTermChange: jest.fn(),
  reset: jest.fn(),
};
jest.mock('#features/catalog/hooks/useBrandAutocomplete', () => ({
  useBrandAutocomplete: () => mockAutocomplete,
}));

const renderSheet = (onPick = jest.fn().mockResolvedValue(true)) => {
  const onDismiss = jest.fn();
  const sheet = () => (
    <AddBrandSheet
      visible
      listName="Avoid"
      heldBrandIds={new Set(['b-soda'])}
      onDismiss={onDismiss}
      onPick={onPick}
    />
  );
  const { rerender } = render(sheet());
  return { onPick, onDismiss, rerender: () => rerender(sheet()) };
};

describe('AddBrandSheet', () => {
  beforeEach(() => {
    mockAutocomplete.searchTerm = '';
  });

  it('lists brands only once the user searches, leaving out ones the list holds', () => {
    const { rerender } = renderSheet();
    expect(screen.queryByText('ChipCo')).toBeNull();

    mockAutocomplete.searchTerm = 'co';
    rerender();

    expect(screen.getByText('ChipCo')).toBeTruthy();
    expect(screen.queryByText('SodaCo')).toBeNull();
  });

  it('adds the brand picked with the note typed, then closes', async () => {
    mockAutocomplete.searchTerm = 'chip';
    const { onPick, onDismiss } = renderSheet();

    fireEvent.changeText(
      screen.getByPlaceholderText(t('brandLists.notePlaceholder')),
      ' too salty ',
    );
    fireEvent.press(
      screen.getByLabelText(t('labels.addNamed', { name: 'ChipCo' })),
    );

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onPick).toHaveBeenCalledWith(
      { id: 'b-chips', name: 'ChipCo' },
      'too salty',
    );
  });

  it('stays open when the add is refused', async () => {
    mockAutocomplete.searchTerm = 'chip';
    const { onPick, onDismiss } = renderSheet(
      jest.fn().mockResolvedValue(false),
    );

    fireEvent.press(
      screen.getByLabelText(t('labels.addNamed', { name: 'ChipCo' })),
    );

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
