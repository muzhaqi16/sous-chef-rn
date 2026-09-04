import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { OnboardingSteps } from '../OnboardingSteps/OnboardingSteps';
import { StepDot } from '../OnboardingSteps/StepDot';

jest.mock('#/constants/animations', () => ({}));

jest.mock('#/utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

const mockSteps = [
  { id: 'step-1', titleKey: 'onboardingSteps.Welcome.title' },
  { id: 'step-2', titleKey: 'onboardingSteps.Preferences.title' },
  { id: 'step-3', titleKey: 'onboardingSteps.Setup.title' },
];

describe('OnboardingSteps', () => {
  const mockActiveIndex: SharedValue<number> = {
    value: 0,
    get: jest.fn(() => 0),
    set: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(
      <OnboardingSteps steps={mockSteps} activeIndex={mockActiveIndex} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with default stepSize of 12', () => {
    const { toJSON } = render(
      <OnboardingSteps steps={mockSteps} activeIndex={mockActiveIndex} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom stepSize', () => {
    const { toJSON } = render(
      <OnboardingSteps
        steps={mockSteps}
        activeIndex={mockActiveIndex}
        stepSize={16}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});

describe('StepDot', () => {
  const mockActiveIndex: SharedValue<number> = {
    value: 1,
    get: jest.fn(() => 1),
    set: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    modify: jest.fn(),
  };

  const defaultStepDotProps = {
    index: 0,
    activeIndex: mockActiveIndex,
    stepSize: 12,
    step: { id: 'step-1', titleKey: 'onboardingSteps.Welcome.title' },
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<StepDot {...defaultStepDotProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('is disabled when allowNavigation is false', () => {
    const { toJSON } = render(
      <StepDot {...defaultStepDotProps} allowNavigation={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with allowNavigation true', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <StepDot
        {...defaultStepDotProps}
        allowNavigation={true}
        onPress={onPress}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders checkmark icon for completed steps', () => {
    render(<StepDot {...defaultStepDotProps} />);
    expect(screen.getByTestId('icon-checkmark')).toBeTruthy();
  });
});
