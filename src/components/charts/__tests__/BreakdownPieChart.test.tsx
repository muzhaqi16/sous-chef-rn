'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BreakdownPieChart } from '../BreakdownPieChart';

jest.mock('victory-native', () => ({
  PolarChart: ({ children }: any) => {
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
