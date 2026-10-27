import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { profileTestIDs } from '#features/profile/testIDs';
import { AddToBrandListSheet } from '../AddToBrandListSheet';

const BRAND = { id: 'b-jif', name: 'Jif' };
const LISTS = [
  {
    id: 'l-boycott',
    name: 'Boycott',
    enabled: true,
    brands: [{ entryId: 'e-1', brandId: 'b-jif', name: 'Jif', reason: null }],
  },
  { id: 'l-avoid', name: 'Avoid', enabled: true, brands: [] },
];

describe('AddToBrandListSheet', () => {
  it('puts the brand on the list picked, with the note typed, then closes', async () => {
    const onPick = jest.fn().mockResolvedValue(true);
    const onDismiss = jest.fn();
    render(
      <AddToBrandListSheet
        visible
        brand={BRAND}
        lists={LISTS}
        onDismiss={onDismiss}
        onPick={onPick}
        onMakeList={jest.fn()}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText(t('brandLists.notePlaceholder')),
      ' too sweet ',
    );
    fireEvent.press(screen.getByText('Avoid'));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(onPick).toHaveBeenCalledWith('l-avoid', 'too sweet');
  });

  it('marks a list the brand is already on, and adds nothing there', () => {
    const onPick = jest.fn();
    render(
      <AddToBrandListSheet
        visible
        brand={BRAND}
        lists={LISTS}
        onDismiss={jest.fn()}
        onPick={onPick}
        onMakeList={jest.fn()}
      />,
    );

    expect(screen.getByText(t('brandLists.alreadyOn'))).toBeTruthy();
    fireEvent.press(screen.getByText('Boycott'));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('sends a user with no lists to make one', () => {
    const onMakeList = jest.fn();
    render(
      <AddToBrandListSheet
        visible
        brand={BRAND}
        lists={[]}
        onDismiss={jest.fn()}
        onPick={jest.fn()}
        onMakeList={onMakeList}
      />,
    );

    expect(screen.getByTestId(profileTestIDs.addToBrandListSheet)).toBeTruthy();
    fireEvent.press(screen.getByText(t('brandLists.newList')));
    expect(onMakeList).toHaveBeenCalled();
  });
});
