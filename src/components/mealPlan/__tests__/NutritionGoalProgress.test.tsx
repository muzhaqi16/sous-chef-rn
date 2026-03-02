'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NutritionGoalProgress } from '../NutritionGoalProgress';

jest.mock('#generated', () => ({
  GoalStatus: {
    OnTarget: 'ON_TARGET',
    UnderTarget: 'UNDER_TARGET',
    OverTarget: 'OVER_TARGET',
  },
}));

const makeProgress = (current: number, target: number, percentage: number, status: string) => ({
  current,
  target,
  percentage,
  status,
});

describe('NutritionGoalProgress', () => {
  const defaultProps: any = {
    overallScore: 85,
    caloriesProgress: makeProgress(1800, 2000, 90, 'ON_TARGET'),
    proteinProgress: makeProgress(120, 150, 80, 'UNDER_TARGET'),
    carbsProgress: makeProgress(250, 200, 125, 'OVER_TARGET'),
    fatProgress: makeProgress(60, 70, 86, 'ON_TARGET'),
  };

  it('renders the overall score', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getByText('Overall Score')).toBeTruthy();
    expect(screen.getByText('85/100')).toBeTruthy();
  });

  it('renders calories progress bar', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByText('1800 / 2000')).toBeTruthy();
    expect(screen.getByText('90%')).toBeTruthy();
  });

  it('renders protein progress bar', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getByText('Protein (g)')).toBeTruthy();
    expect(screen.getByText('120 / 150')).toBeTruthy();
  });

  it('renders carbs progress bar', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getByText('Carbs (g)')).toBeTruthy();
    expect(screen.getByText('250 / 200')).toBeTruthy();
  });

  it('renders fat progress bar', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getByText('Fat (g)')).toBeTruthy();
    expect(screen.getByText('60 / 70')).toBeTruthy();
  });

  it('shows status labels for each macro', () => {
    render(<NutritionGoalProgress {...defaultProps} />);
    expect(screen.getAllByText('On Target').length).toBeGreaterThan(0);
    expect(screen.getByText('Under')).toBeTruthy();
    expect(screen.getByText('Over')).toBeTruthy();
  });

  it('does not render progress bar when data is null', () => {
    render(<NutritionGoalProgress {...defaultProps} fatProgress={null} />);
    expect(screen.queryByText('Fat (g)')).toBeNull();
  });
});
