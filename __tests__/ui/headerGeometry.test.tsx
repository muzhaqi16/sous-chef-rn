import React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Header } from '#components/organisms/Header';
import { UnistylesRuntime } from 'react-native-unistyles';
import {
  gutterTargetGeometry,
  type BarAction,
} from '#components/molecules/BarActions';
import { applyAppearanceToRuntime } from '#theme/applyAppearance';
import { DensityPreference } from '#store/slices/preferenceTypes';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import {
  CollapsingHeroDetail,
  HEADER_BAND_HEIGHT,
} from '#components/templates/CollapsingHeroDetail';
import { kitTestIDs } from '#components/testIDs';
import { Screen } from '#components/templates/Screen';
import { lightTheme, type Theme } from '#theme/themes';

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

/**
 * The nearest ancestor that declares a horizontal padding, past the target's
 * own component wrappers, which carry its testID and its style.
 */
const barOf = (node: ReturnType<typeof screen.getByTestId>) => {
  let current = node.parent;
  while (current) {
    const style = flat(current.props.style);
    const isOwnWrapper =
      !!node.props.testID && current.props.testID === node.props.testID;
    if (!isOwnWrapper && style.paddingHorizontal !== undefined) return style;
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

/** The nearest ancestor whose style declares `key`. */
const ancestorStyleWith = (
  node: ReturnType<typeof screen.getByTestId>,
  key: keyof ViewStyle,
) => {
  let current = node.parent;
  while (current) {
    const style = flat(current.props.style);
    if (style[key] !== undefined) return style;
    current = current.parent;
  }
  throw new Error(`no ancestor declares ${key}`);
};

/**
 * A trailing action obeys the same rule as the back glyph, whether it is an
 * icon or a label. `Header` reserves the target's slack in its inset, so each
 * target is whole and a label is padded by the slack an icon has; a bar on a
 * content gutter has whole targets too, pulled out so the glyph takes the edge.
 */
describe('bar actions put their outermost glyph on the page gutter', () => {
  const ACTIONS: BarAction[] = [
    {
      icon: 'add',
      accessibilityLabel: 'Add',
      onPress: jest.fn(),
      testID: 'icon-action',
    },
    { label: 'Save', onPress: jest.fn(), testID: 'text-action' },
  ];

  it('Header: every target is whole, a label padded like an icon', () => {
    render(<Header title="Title" rightActions={ACTIONS} />);
    const icon = screen.getByTestId('icon-action');
    const text = screen.getByTestId('text-action');
    const textTarget = flat(text.props.style);

    expect(flat(icon.props.style).minWidth).toBe(sizes.touchTarget.md);
    expect(textTarget.minHeight).toBe(sizes.touchTarget.md);
    expect(
      Number(barOf(text).paddingHorizontal) +
        Number(textTarget.paddingHorizontal),
    ).toBe(layout.pageGutter);
  });

  // Hit slop past the bar's bounds is dead, so the target is a real box.
  it('a gutter bar: whole targets, pulled out so the glyph takes the edge', () => {
    render(<TabScreenHeader title="Title" actions={ACTIONS} />);
    const { pull } = gutterTargetGeometry(lightTheme);

    const icon = screen.getByTestId('icon-action');
    expect(flat(icon.props.style).minWidth).toBe(sizes.touchTarget.min);
    expect(icon.props.hitSlop).toBeUndefined();
    expect(
      Number(ancestorStyleWith(icon, 'marginHorizontal').marginHorizontal),
    ).toBe(-pull);
    expect(
      flat(screen.getByTestId('text-action').props.style).paddingHorizontal,
    ).toBe(pull);
  });

  it('glyphs sit the same distance apart in either bar', () => {
    const gapOf = () =>
      Number(ancestorStyleWith(screen.getByTestId('icon-action'), 'gap').gap);

    const header = render(<Header title="Title" rightActions={ACTIONS} />);
    const barGap = gapOf();
    header.unmount();
    render(<TabScreenHeader title="Title" actions={ACTIONS} />);

    expect(barGap + 2 * GLYPH_SLACK).toBe(
      gapOf() + 2 * gutterTargetGeometry(lightTheme).pull,
    );
  });
});

/** The light theme `applyAppearanceToRuntime` hands Unistyles at `density`. */
function themeAt(density: DensityPreference): Theme {
  const runtime = jest.mocked(UnistylesRuntime);
  runtime.updateTheme.mockClear();
  applyAppearanceToRuntime({
    primaryColorOverride: null,
    densityPreference: density,
    fontScalePreference: null,
    highContrast: false,
  });
  const light = runtime.updateTheme.mock.calls.find(
    ([name]) => name === 'light',
  );
  if (!light) throw new Error('no light theme was built');
  return light[1](lightTheme);
}

// The glyph grows with density; a gutter target measured 40/44/48 pt when its
// slack was fixed. It stays at the floor, with the glyph on the gutter.
describe('a gutter target at every density', () => {
  it.each([
    DensityPreference.COMPACT,
    DensityPreference.COMFORTABLE,
    DensityPreference.SPACIOUS,
  ])('stays at the floor with its glyph on the gutter: %s', density => {
    const theme = themeAt(density);
    const { box, pull } = gutterTargetGeometry(theme);

    expect(box).toBe(lightTheme.sizes.touchTarget.min);
    expect(theme.sizes.icon.md + 2 * pull).toBe(box);
  });
});

describe('standard header titles', () => {
  it('are always centred', () => {
    render(
      <Screen header={{ title: 'Appearance', back: jest.fn() }}>{null}</Screen>,
    );

    expect(screen.UNSAFE_getByType(Header).props.centerTitle).toBe(true);
  });

  it('sit on the bar centre when only one side has actions', () => {
    render(<Header title="Home Details" onBack={jest.fn()} centerTitle />);

    // The two action groups are the header's only measured host views.
    const [left, right, ...rest] = screen.UNSAFE_root.findAll(
      node => typeof node.type === 'string' && !!node.props.onLayout,
    );
    if (!left || !right || rest.length > 0) {
      throw new Error('expected exactly one action group per side');
    }
    const layoutOfWidth = (width: number) => ({
      nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } },
    });
    fireEvent(left, 'layout', layoutOfWidth(44));
    fireEvent(right, 'layout', layoutOfWidth(0));

    const { marginLeft, marginRight } = flat(
      screen.getByText('Home Details').props.style,
    );
    expect(44 + Number(marginLeft)).toBe(0 + Number(marginRight));
  });
});
