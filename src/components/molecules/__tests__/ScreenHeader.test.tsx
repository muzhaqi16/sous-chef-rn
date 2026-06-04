import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';
import { Text } from '#components/atoms/Text';

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

describe('ScreenHeader', () => {
  const defaultProps = {
    title: 'Screen Title',
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<ScreenHeader {...defaultProps} />);
    expect(screen.getByText('Screen Title')).toBeTruthy();
  });

  it('calls onBack when back button is pressed', async () => {
    const user = userEvent.setup();
    render(<ScreenHeader {...defaultProps} />);
    const backButton = screen.getByLabelText('Go back');
    await user.press(backButton);
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('renders rightElement when provided', () => {
    render(<ScreenHeader {...defaultProps} rightElement={<Text>Save</Text>} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders placeholder when no rightElement is provided', () => {
    const { toJSON } = render(<ScreenHeader {...defaultProps} />);
    // Should render without error; placeholder view fills space
    expect(toJSON()).toBeTruthy();
  });

  it('disables back button when backButtonDisabled is true', () => {
    render(<ScreenHeader {...defaultProps} backButtonDisabled />);
    const backButton = screen.getByLabelText('Go back');
    expect(backButton.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
