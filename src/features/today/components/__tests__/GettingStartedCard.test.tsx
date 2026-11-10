import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { todayTestIDs } from '#features/today/testIDs';
import type { GettingStartedItem } from '#features/today/hooks/useGettingStarted';
import { GettingStartedCard } from '../GettingStartedCard';

const itemsWith = (done: GettingStartedItem[]) =>
  (['stock', 'shop', 'cook', 'plan'] as const).map(id => ({
    id,
    done: done.includes(id),
  }));

const renderCard = (done: GettingStartedItem[] = [], allDone = false) => {
  const onStart = jest.fn();
  const onHide = jest.fn();
  render(
    <GettingStartedCard
      items={itemsWith(done)}
      doneCount={done.length}
      allDone={allDone}
      onStart={onStart}
      onHide={onHide}
    />,
  );
  return { onStart, onHide };
};

describe('GettingStartedCard', () => {
  it('The items a new owner sees: four in order, and "1 of 4 done"', () => {
    renderCard(['stock']);

    expect(screen.getAllByText('1 of 4 done').length).toBeGreaterThan(0);
    expect(
      [
        'Stock your pantry',
        'Shop from your list',
        'Cook from your pantry',
        'Plan a meal',
      ].map(label => screen.getByRole('button', { name: label })),
    ).toHaveLength(4);
  });

  it('Arriving from onboarding with staples: "Shop from your list" is offered first', () => {
    const { onStart } = renderCard(['stock']);

    fireEvent.press(screen.getByTestId(todayTestIDs.gettingStartedStart));

    expect(onStart).toHaveBeenCalledWith('shop');
  });

  it('starts any undone item from its row, and none that is done', () => {
    const { onStart } = renderCard(['stock']);

    fireEvent.press(
      screen.getByTestId(todayTestIDs.gettingStartedItem('plan')),
    );
    fireEvent.press(
      screen.getByTestId(todayTestIDs.gettingStartedItem('stock')),
    );

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith('plan');
  });

  it('Hiding the card', () => {
    const { onHide } = renderCard();

    fireEvent.press(screen.getByTestId(todayTestIDs.gettingStartedHide));

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('The last item: says everything is done, with nothing left to start', () => {
    renderCard(['stock', 'shop', 'cook', 'plan'], true);

    expect(screen.getByText('That’s the basics covered')).toBeTruthy();
    expect(screen.queryByTestId(todayTestIDs.gettingStartedStart)).toBeNull();
  });
});
