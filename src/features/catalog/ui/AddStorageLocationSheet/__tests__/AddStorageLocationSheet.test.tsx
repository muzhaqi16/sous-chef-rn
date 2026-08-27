'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { AddStorageLocationSheet } from '../AddStorageLocationSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        border: '#ccc',
        surfaceVariant: '#f0f0f0',
        error: '#ff0000',
      },
    },
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

// requestIdleCallback is not available in the test environment
global.requestIdleCallback = (cb: IdleRequestCallback): number => {
  setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0);
  return 0;
};

describe('AddStorageLocationSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onCreateLocation: jest.fn(() => Promise.resolve()),
    creating: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    expect(screen.getByText('Add Location')).toBeTruthy();
  });

  it('renders Cancel and Create buttons', () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('renders location name label', () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    expect(screen.getByText('Location Name')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('e.g., Kitchen Cabinet, Garage Shelf'),
    ).toBeTruthy();
  });

  it('renders hint text', () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    expect(screen.getByText(/You can edit details later/)).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<AddStorageLocationSheet {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error when trying to create with empty name via onSubmitEditing', async () => {
    render(<AddStorageLocationSheet {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      'e.g., Kitchen Cabinet, Garage Shelf',
    );
    fireEvent(input, 'submitEditing');
    expect(screen.getByText('Location name is required')).toBeTruthy();
  });

  it('calls onCreateLocation with valid name', async () => {
    const user = userEvent.setup();
    render(<AddStorageLocationSheet {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      'e.g., Kitchen Cabinet, Garage Shelf',
    );
    fireEvent.changeText(input, 'Kitchen');
    await user.press(screen.getByText('Create'));
    expect(defaultProps.onCreateLocation).toHaveBeenCalledWith({
      name: 'Kitchen',
      type: 'CUSTOM',
    });
  });
});
