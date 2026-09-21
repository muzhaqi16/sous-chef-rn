import React from 'react';
import { ScrollView, View } from 'react-native';
import { render, renderHook, screen } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '#components/templates/Screen';
import { useScreenListInset } from '#components/templates/useScreenListInset';
import { lightTheme } from '#/theme/themes';

/**
 * The `scroll` host pads its content by the bottom inset, so iOS's automatic
 * adjustment must stay off: together they reserved 68pt on an iPhone 17
 * (measured: content 1116pt in a 751pt view rested at offset 399, not 365).
 */

const HOME_INDICATOR = 34;
const CLEARED = HOME_INDICATOR + lightTheme.layout.pageBottom;

const paddingsOf = (style: unknown) =>
  [style]
    .flat(3)
    .map(entry => (entry as { paddingBottom?: unknown } | null)?.paddingBottom);

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

    expect(paddingsOf(host.props.contentContainerStyle)).toContain(CLEARED);
    expect(host.props.contentInsetAdjustmentBehavior).toBe('never');
  });

  it('gives a list child the same trailing space through the hook', () => {
    const { result } = renderHook(() => useScreenListInset());

    expect(paddingsOf(result.current)).toContain(CLEARED);
  });

  it('moves the inset to the footer when there is one', () => {
    const { UNSAFE_getByType } = render(
      <Screen scroll="scroll" footer={<View testID="footer" />}>
        {null}
      </Screen>,
    );
    const host = UNSAFE_getByType(ScrollView);
    let footerHost = screen.getByTestId('footer').parent;
    while (footerHost && !footerHost.props.style)
      footerHost = footerHost.parent;

    expect(paddingsOf(host.props.contentContainerStyle)).not.toContain(CLEARED);
    expect(paddingsOf(footerHost?.props.style)).toContain(
      HOME_INDICATOR + lightTheme.spacing.sm,
    );
  });
});
