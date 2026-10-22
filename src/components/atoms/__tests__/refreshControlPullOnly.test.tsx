import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';

/**
 * A list's `refreshing` is often the query's own refetch state, which a resync
 * sets too. Only a pull the user made spins: iOS leaves a spinner stuck when
 * its refresh ends while the screen is covered, and a resync often does.
 */
const list = (refreshing: boolean, onRefresh: () => unknown) => (
  <ScrollView
    refreshControl={
      <PlainScrollRefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    }
  />
);

// React Native's jest mock renders the control with none of its props.
const control = () => screen.UNSAFE_getByType(RefreshControl).props;
const spinning = () => control().refreshing;

describe('the themed refresh control', () => {
  it('does not spin for a refresh the app started', () => {
    render(list(true, jest.fn()));

    expect(spinning()).toBe(false);
  });

  it('spins for a pull until its refresh ends, and not for the next resync', () => {
    const onRefresh = jest.fn();
    const { rerender } = render(list(false, onRefresh));

    act(() => {
      control().onRefresh();
    });
    rerender(list(true, onRefresh));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(spinning()).toBe(true);

    rerender(list(false, onRefresh));
    expect(spinning()).toBe(false);

    rerender(list(true, onRefresh));
    expect(spinning()).toBe(false);
  });

  it('lets go of a pull whose refresh never started', async () => {
    const noRefresh = jest.fn(() => Promise.resolve());
    const { rerender } = render(list(false, noRefresh));

    await act(async () => {
      control().onRefresh();
      await Promise.resolve();
    });
    rerender(list(true, noRefresh));

    expect(spinning()).toBe(false);
  });
});
