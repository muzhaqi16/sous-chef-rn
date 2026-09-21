import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { render, screen } from '@testing-library/react-native';
import { Header } from '#components/organisms/Header';
import {
  CollapsingHeroDetail,
  HEADER_BAND_HEIGHT,
} from '#components/templates/CollapsingHeroDetail';
import { kitTestIDs } from '#components/testIDs';
import { Screen } from '#components/templates/Screen';
import { lightTheme } from '#/theme/themes';

/**
 * Every bar puts its back glyph where the page content starts, so moving
 * between a settings screen and a hero detail never moves the arrow. The glyph
 * sits centred in its touch target, so the bar inset plus the target's slack
 * must equal the gutter.
 */

const { layout, sizes, spacing } = lightTheme;
const GLYPH_SLACK = (sizes.touchTarget.md - sizes.icon.md) / 2;

const flat = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style as ViewStyle) ?? {};

/** The nearest ancestor that declares a horizontal padding or left inset. */
const barOf = (node: ReturnType<typeof screen.getByTestId>) => {
  let current = node.parent;
  while (current) {
    const style = flat(current.props.style);
    if (style.paddingHorizontal !== undefined) return style;
    current = current.parent;
  }
  throw new Error('no bar ancestor declares a horizontal inset');
};

describe('header bars put the back glyph on the page gutter', () => {
  it('Header', () => {
    render(<Header title="Title" onBack={jest.fn()} />);
    const back = screen.getByTestId(kitTestIDs.headerBackButton);
    const target = flat(back.props.style);
    const bar = barOf(back);

    expect(target.minWidth).toBe(sizes.touchTarget.md);
    expect(Number(bar.paddingHorizontal) + GLYPH_SLACK).toBe(layout.pageGutter);
    expect(Number(bar.paddingVertical) * 2 + Number(target.minHeight)).toBe(
      HEADER_BAND_HEIGHT,
    );
  });

  it('CollapsingHeroDetail', () => {
    render(
      <CollapsingHeroDetail
        onBack={jest.fn()}
        actions={[]}
        renderHero={() => null}
      >
        {null}
      </CollapsingHeroDetail>,
    );
    const back = screen.getByLabelText('Go Back');
    const chip = flat(back.props.style);
    const bar = barOf(back);

    expect(chip.width).toBe(sizes.touchTarget.md);
    expect(Number(bar.paddingHorizontal) + GLYPH_SLACK).toBe(layout.pageGutter);
    expect(HEADER_BAND_HEIGHT).toBe(spacing.sm * 2 + sizes.touchTarget.md);
  });
});

describe('standard header titles', () => {
  it('are always centred', () => {
    render(
      <Screen header={{ title: 'Appearance', back: jest.fn() }}>{null}</Screen>,
    );

    expect(screen.UNSAFE_getByType(Header).props.centerTitle).toBe(true);
  });
});
