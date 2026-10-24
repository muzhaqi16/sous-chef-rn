import React from 'react';
import { ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { render, screen } from '@testing-library/react-native';
import { getScrollClearancePadding } from '#constants/layout';
import { Screen } from '../Screen';

const scrollContentBottom = () => {
  const host = screen.UNSAFE_getByType(ScrollView);
  const styles: unknown[] = [host.props.contentContainerStyle].flat(Infinity);
  const flat: { paddingBottom?: number } = Object.assign(
    {},
    ...styles.filter(Boolean),
  );
  return flat.paddingBottom;
};

describe('Screen', () => {
  // The floating tab bar and its + overlay a tab root: without the clearance
  // its last rows sit under them, and a short overflow cannot scroll at all.
  it("scrolls a tab root's content out from under the floating tab bar", () => {
    render(
      <Screen header={{ variant: 'tab', title: 'Today' }} scroll="scroll">
        <Text>Shopping List</Text>
      </Screen>,
    );

    expect(scrollContentBottom()).toBeGreaterThanOrEqual(
      getScrollClearancePadding(0),
    );
  });

  it('pads a pushed screen only for its own trailing space', () => {
    render(
      <Screen header={{ title: 'Details', back: jest.fn() }} scroll="scroll">
        <Text>Body</Text>
      </Screen>,
    );

    expect(scrollContentBottom()).toBeLessThan(getScrollClearancePadding(0));
  });
});
