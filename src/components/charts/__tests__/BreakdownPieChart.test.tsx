'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BreakdownPieChart } from '../BreakdownPieChart';

jest.mock('victory-native', () => ({
  PolarChart: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { testID: 'polar-chart' }, children);
  },
  Pie: {
    Chart: () => null,
  },
}));

describe('BreakdownPieChart', () => {
  const sampleData = [
    { label: 'Protein', value: 150, percentage: 30 },
    { label: 'Carbs', value: 250, percentage: 50 },
    { label: 'Fat', value: 100, percentage: 20 },
  ];

  it('renders empty state when no data', () => {
    render(<BreakdownPieChart data={[]} />);
    expect(screen.getByText('No data available')).toBeTruthy();
  });

  it('renders chart when data is provided', () => {
    render(<BreakdownPieChart data={sampleData} />);
    expect(screen.getByTestId('polar-chart')).toBeTruthy();
  });

  it('renders title when provided', () => {
    render(<BreakdownPieChart data={sampleData} title="Macro Breakdown" />);
    expect(screen.getByText('Macro Breakdown')).toBeTruthy();
  });

  it('renders legend by default', () => {
    render(<BreakdownPieChart data={sampleData} />);
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
  });

  it('renders percentages in legend', () => {
    render(<BreakdownPieChart data={sampleData} />);
    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('renders title in empty state', () => {
    render(<BreakdownPieChart data={[]} title="Empty Chart" />);
    expect(screen.getByText('Empty Chart')).toBeTruthy();
  });

  it('hides legend when showLegend is false', () => {
    render(<BreakdownPieChart data={sampleData} showLegend={false} />);
    expect(screen.queryByText('30%')).toBeNull();
  });
});

describe('the default palette', () => {
  /**
   * A data color must be opaque in BOTH themes.
   *
   * Slot 3 used to be `theme.colors.primaryLight`, which the DARK theme defines
   * as `brand[400] + '20'` — an 8-digit hex whose alpha byte is 12.5%, and which
   * `themes.ts` describes as an "accent surface". It feeds both the Skia slice
   * fill and the legend chip's `backgroundColor`, so the third category vanished
   * from the chart and its legend in dark mode. The one consumer that passes no
   * `colorScale` is the Pantry Analytics usage-purpose pie.
   */
  const OPAQUE_HEX = /^#[0-9a-fA-F]{6}$/;

  it.each(['light', 'dark'] as const)(
    'has no translucent entry in the %s theme',
    themeName => {
      const { lightTheme, darkTheme } = require('#/theme/themes');
      const theme = themeName === 'light' ? lightTheme : darkTheme;
      const { __testables } =
        require('../BreakdownPieChart') as typeof import('../BreakdownPieChart');

      for (const color of __testables.brandFirstColors(theme)) {
        expect(color).toMatch(OPAQUE_HEX);
      }
    },
  );

  it('never uses a surface tint as a data color', () => {
    const { darkTheme } = require('#/theme/themes');
    const { __testables } =
      require('../BreakdownPieChart') as typeof import('../BreakdownPieChart');

    expect(__testables.brandFirstColors(darkTheme)).not.toContain(
      darkTheme.colors.primaryLight,
    );
  });

  it('keeps adjacent slices distinguishable', () => {
    // `primary` and `primaryDark` were consecutive steps of one ramp, which is
    // not the separation a categorical scale needs.
    const { darkTheme } = require('#/theme/themes');
    const { __testables } =
      require('../BreakdownPieChart') as typeof import('../BreakdownPieChart');
    const colors = __testables.brandFirstColors(darkTheme);

    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).not.toContain(darkTheme.colors.primaryDark);
  });
});
