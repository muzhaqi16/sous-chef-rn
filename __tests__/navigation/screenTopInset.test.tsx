import React from 'react';
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  topInsetScreenLayout,
  topInsetWith,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';
import { Screen, type ScreenProps } from '#components/templates/Screen';
import { Text } from '#components/atoms/Text';

/**
 * The top inset is applied by the NAVIGATOR, once per screen, and `Screen`
 * never applies it. Two writers are one status bar of dead space that only
 * shows on a device with a notch — invisible to typecheck, lint and every
 * other test.
 *
 * `check-screen-scaffold` holds the static half: a screen naming `insets.top`
 * or a bare `SafeAreaView` is a finding. What it cannot see is the COMPOSITION
 * — a layout and a template that each apply the inset correctly on their own
 * and twice together. That is what renders here.
 */

jest.mock('#components/organisms/Header', () => {
  const { View: RNView } = require('react-native');
  return { Header: () => <RNView testID="header" /> };
});

const STATUS_BAR = 47;

/** Every `paddingTop` in the tree that equals the mocked inset. */
const insetPaddings = (json: unknown): number[] => {
  const found: number[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const el = node as { props?: Record<string, unknown>; children?: unknown };
    const style = el.props?.style;
    for (const entry of [style].flat(3)) {
      const pt = (entry as { paddingTop?: unknown } | undefined)?.paddingTop;
      if (pt === STATUS_BAR) found.push(pt as number);
    }
    walk(el.children);
  };
  walk(json);
  return found;
};

describe('the top inset is applied exactly once', () => {
  beforeEach(() => {
    (useSafeAreaInsets as jest.Mock).mockReturnValue({
      top: STATUS_BAR,
      bottom: 0,
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

  it('reads the inset at all, so the counts below are not vacuous', () => {
    const tree = render(topInsetScreenLayout({ children: <View /> })).toJSON();
    expect(insetPaddings(tree)).toHaveLength(1);
  });

  const cases: Array<[string, ScreenProps]> = [
    [
      'a standard header',
      { children: null, header: { variant: 'standard', title: 'T' } },
    ],
    ['a tab header', { children: null, header: { variant: 'tab', title: 'T' } }],
    ['no header', { children: null, header: { variant: 'none' } }],
    ['scroll="scroll"', { children: null, scroll: 'scroll' }],
    ['scroll="form"', { children: null, scroll: 'form' }],
    ['scroll="none"', { children: null, scroll: 'none' }],
    ['scroll="list"', { children: null, scroll: 'list' }],
  ];

  it.each(cases)('adds no second inset for a Screen with %s', (_label, props) => {
    const tree = render(
      topInsetScreenLayout({
        children: (
          <Screen {...props}>
            <Text role="body">content</Text>
          </Screen>
        ),
      }),
    ).toJSON();

    expect(insetPaddings(tree)).toHaveLength(1);
  });

  it('applies it once through a boundary-wrapping layout', () => {
    const Boundary = ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    );
    const tree = render(
      topInsetWith(Boundary)({
        children: (
          <Screen header={{ variant: 'none' }}>
            <Text role="body">content</Text>
          </Screen>
        ),
      }),
    ).toJSON();

    expect(insetPaddings(tree)).toHaveLength(1);
  });

  it('applies none for a screen that opts out', () => {
    const tree = render(
      <>
        {noInsetScreenLayout({
          children: (
            <Screen header={{ variant: 'none' }}>
              <Text role="body">content</Text>
            </Screen>
          ),
        })}
      </>,
    ).toJSON();

    expect(insetPaddings(tree)).toHaveLength(0);
  });
});

/**
 * The opt-out is per SCREEN, so it has to be read as a list rather than trusted
 * one file at a time: a screen that drops the inset by accident looks exactly
 * like one that meant to, and only the roster shows the difference.
 */
describe('every screen that opts out of the inset is a deliberate one', () => {
  const IMMERSIVE = [
    // A full-bleed camera that hides the status bar while focused.
    'src/features/barcode/screens/registration.ts',
    // Hero screens: the detail header draws edge-to-edge under the status bar.
    'src/features/pantry/screens/registration.ts',
    'src/features/recipes/screens/registration.ts',
    'src/features/shoppingList/screens/registration.ts',
    // A nested navigator insets in its own stack, so the parent must not.
    'src/navigation/RootNavigator.tsx',
    // The module that DEFINES the opt-out.
    'src/navigation/layouts/TopInsetLayout.tsx',
  ];

  const registrations = [
    ...new Set([
      ...globSync('src/features/*/screens/registration.ts'),
      ...globSync('src/navigation/**/*.tsx'),
    ]),
  ] as string[];

  it('finds the registration modules, so the check is not vacuous', () => {
    expect(registrations.length).toBeGreaterThan(10);
  });

  it('names noInsetScreenLayout only in the recorded modules', () => {
    const users = registrations.filter(file =>
      /\bnoInsetScreenLayout\b/.test(readFileSync(file, 'utf8')),
    );
    expect(users.sort()).toEqual(
      IMMERSIVE.filter(f => registrations.includes(f)).sort(),
    );
  });
});
