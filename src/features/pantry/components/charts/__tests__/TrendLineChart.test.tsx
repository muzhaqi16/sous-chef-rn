'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TrendLineChart } from '../TrendLineChart';
import type { TimeSeriesDataPoint } from '#/graphql/generated/schemaTypes';

type CartesianRenderArgs = {
  points: { y: { x: number; y: number }[] };
  chartBounds: { bottom: number };
};

jest.mock('victory-native', () => ({
  CartesianChart: ({
    children,
  }: {
    children:
      | React.ReactNode
      | ((args: CartesianRenderArgs) => React.ReactNode);
  }) => {
    const { View } = require('react-native');
    const R = require('react');
    const mockPoints = { y: [{ x: 0, y: 10 }] };
    const mockBounds = { bottom: 200 };
    return R.createElement(
      View,
      { testID: 'cartesian-chart' },
      typeof children === 'function'
        ? children({ points: mockPoints, chartBounds: mockBounds })
        : children,
    );
  },
  Line: () => null,
  Area: () => null,
}));

jest.mock('@shopify/react-native-skia', () => ({
  matchFont: jest.fn(() => null),
  Circle: 'Circle',
}));

describe('TrendLineChart', () => {
  const sampleData: TimeSeriesDataPoint[] = [
    {
      __typename: 'TimeSeriesDataPoint',
      date: '2024-01-01',
      count: 10,
      value: 10,
    },
    {
      __typename: 'TimeSeriesDataPoint',
      date: '2024-01-02',
      count: 20,
      value: 20,
    },
    {
      __typename: 'TimeSeriesDataPoint',
      date: '2024-01-03',
      count: 15,
      value: 15,
    },
  ];

  it('renders empty state when no data', () => {
    render(<TrendLineChart data={[]} />);
    expect(screen.getByText('No data available')).toBeTruthy();
  });

  it('renders chart when data is provided', () => {
    render(<TrendLineChart data={sampleData} />);
    expect(screen.getByTestId('cartesian-chart')).toBeTruthy();
  });

  it('renders title when provided', () => {
    render(<TrendLineChart data={sampleData} title="Shopping Trends" />);
    expect(screen.getByText('Shopping Trends')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(
      <TrendLineChart
        data={sampleData}
        title="Trends"
        subtitle="Last 7 days"
      />,
    );
    expect(screen.getByText('Last 7 days')).toBeTruthy();
  });

  it('renders title in empty state', () => {
    render(<TrendLineChart data={[]} title="No Data Chart" />);
    expect(screen.getByText('No Data Chart')).toBeTruthy();
    expect(screen.getByText('No data available')).toBeTruthy();
  });

  it('renders with custom height', () => {
    const { toJSON } = render(
      <TrendLineChart data={sampleData} height={300} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
