import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';

/**
 * A screen owns its `refreshing` flag (`executeRefreshWithFinally`), set by the
 * refresh it started; the control shows it as given, a pull's or a button's.
 */
const list = (refreshing: boolean, onRefresh: () => void) => (
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
const control = () =>
  screen.UNSAFE_getByType(RefreshControl).props as {
    refreshing: boolean;
    onRefresh: () => void;
  };

describe('the themed refresh control', () => {
  it('shows the refreshing its screen gives, and hands a pull to the screen', () => {
    const onRefresh = jest.fn();
    const { rerender } = render(list(true, onRefresh));
    expect(control().refreshing).toBe(true);

    rerender(list(false, onRefresh));
    expect(control().refreshing).toBe(false);

    control().onRefresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
