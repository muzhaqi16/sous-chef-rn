import React from 'react';
import { ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '#components/templates/Screen';

/**
 * The `scroll` host pads its content by the bottom inset, so iOS's automatic
 * adjustment must stay off: together they reserved 68pt on an iPhone 17
 * (measured: content 1116pt in a 751pt view rested at offset 399, not 365).
 */

const HOME_INDICATOR = 34;

describe('the scroll host reserves the bottom inset once', () => {
  beforeEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      top: 0,
      bottom: HOME_INDICATOR,
      left: 0,
      right: 0,
    });
  });

  afterAll(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('pads the content and turns the automatic inset off', () => {
    const { UNSAFE_getByType } = render(
      <Screen scroll="scroll">{null}</Screen>,
    );
    const host = UNSAFE_getByType(ScrollView);

    const paddings = [host.props.contentContainerStyle]
      .flat(3)
      .map(
        entry => (entry as { paddingBottom?: unknown } | null)?.paddingBottom,
      );

    expect(paddings).toContain(HOME_INDICATOR);
    expect(host.props.contentInsetAdjustmentBehavior).toBe('never');
  });
});
