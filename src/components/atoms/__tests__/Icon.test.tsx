import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { applyAppearanceToRuntime } from '#/theme/applyAppearance';
import { lightTheme, type Theme } from '#/theme/themes';
import { DensityPreference } from '#store/slices/preferenceTypes';
import { Icon, type IconSizeName } from '../Icon';

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

// The glyph is a private-use character: in a pressable with no label of its
// own, iOS would join it into the derived label ("<glyph>, At Giant-Eagle").
describe('Icon', () => {
  it.each([
    ['a colour', { color: '#123456' }],
    ['a tone', { tone: 'primary' as const }],
    ['the default colour', {}],
  ])('stays out of the accessibility tree with %s', (_label, props) => {
    render(<Icon name="storefront-outline" {...props} />);

    const [glyph] = screen.UNSAFE_root.findAll(
      node =>
        node.props.name === 'storefront-outline' &&
        typeof node.type === 'string',
    );
    expect(glyph?.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  // Spec app/controls, "Larger display density": every icon grows by the same
  // step, a row's small glyph as much as a header's.
  it('grows every icon by the same step at a larger density', () => {
    const steps: IconSizeName[] = ['xs', 'md'];
    render(
      <>
        {steps.map(step => (
          <Icon key={step} name={`glyph-${step}`} size={step} />
        ))}
      </>,
    );
    // The size Unistyles would hand each icon under `theme`.
    const sizeUnder = (step: IconSizeName, theme: Theme): number => {
      const [icon] = screen.UNSAFE_root.findAll(
        node => node.props?.name === `glyph-${step}` && !!node.props.uniProps,
      );
      return icon?.props.uniProps(theme).size;
    };
    const comfortable = themeAt(DensityPreference.COMFORTABLE);
    const spacious = themeAt(DensityPreference.SPACIOUS);

    const growth = steps.map(
      step => sizeUnder(step, spacious) / sizeUnder(step, comfortable),
    );

    for (const ratio of growth) expect(ratio).toBeCloseTo(1.15, 1);
  });
});
