import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import type { BarAction } from '#components/molecules/BarActions';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { Header } from '../Header';
import { splitBarActions } from '../HeaderActionMenu';

const icon = (id: string, extra: Partial<HeaderAction> = {}): HeaderAction => ({
  icon: 'create-outline',
  onPress: jest.fn(),
  accessibilityLabel: id,
  testID: id,
  ...extra,
});

const ids = (actions: readonly BarAction[]) => actions.map(a => a.testID);

describe('splitBarActions', () => {
  it('keeps every action while three fit', () => {
    const actions = [icon('a'), icon('b'), icon('c')];

    expect(splitBarActions(actions)).toEqual({ shown: actions, overflow: [] });
  });

  it('keeps the first two past three, leaving a slot for "more"', () => {
    const { shown, overflow } = splitBarActions([
      icon('a'),
      icon('b'),
      icon('c'),
      icon('d'),
    ]);

    expect(ids(shown)).toEqual(['a', 'b']);
    expect(ids(overflow)).toEqual(['c', 'd']);
  });

  it('never moves a text action or a measured one into the menu', () => {
    const { shown, overflow } = splitBarActions([
      icon('a'),
      icon('b'),
      { label: 'Save', onPress: jest.fn(), testID: 'save' },
      icon('spotlit', { onMeasure: jest.fn() }),
    ]);

    expect(ids(shown)).toEqual(['save', 'spotlit']);
    expect(ids(overflow)).toEqual(['a', 'b']);
  });
});

describe('a bar with more actions than fit', () => {
  const edit = icon('edit');
  const remove = icon('delete', { variant: 'error' });

  beforeEach(() => jest.clearAllMocks());

  const renderBar = () =>
    render(
      <Header
        title="Detail"
        rightActions={[icon('first'), icon('second'), edit, remove]}
      />,
    );

  const closeMenu = () => {
    const { onDismiss } = screen.UNSAFE_getByProps({ detached: true })
      .props as {
      onDismiss: () => void;
    };
    act(() => onDismiss());
  };

  it('shows the leading actions and "more", not the rest', () => {
    renderBar();

    expect(screen.getByTestId('first')).toBeTruthy();
    expect(screen.getByTestId('second')).toBeTruthy();
    expect(screen.getByTestId(kitTestIDs.headerMoreButton)).toBeTruthy();
    expect(screen.queryByTestId('edit')).toBeNull();
  });

  it('runs a menu action once the menu has closed', () => {
    renderBar();

    fireEvent.press(screen.getByTestId(kitTestIDs.headerMoreButton));
    fireEvent.press(screen.getByTestId('delete'));
    expect(remove.onPress).not.toHaveBeenCalled();

    closeMenu();
    expect(remove.onPress).toHaveBeenCalledTimes(1);
    expect(edit.onPress).not.toHaveBeenCalled();
  });

  it('runs nothing when the menu is closed without a choice', () => {
    renderBar();

    fireEvent.press(screen.getByTestId(kitTestIDs.headerMoreButton));
    closeMenu();

    expect(edit.onPress).not.toHaveBeenCalled();
    expect(remove.onPress).not.toHaveBeenCalled();
  });
});
