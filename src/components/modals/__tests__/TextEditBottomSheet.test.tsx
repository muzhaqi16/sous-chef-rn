import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TextEditBottomSheet } from '../TextEditBottomSheet/TextEditBottomSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        error: '#FF0000',
        surface: '#FFF',
        surfaceVariant: '#F5F5F5',
        border: '#CCC',
        background: '#FFF',
      },
      spacing: { sm: 4, md: 8, lg: 16, xs: 2 },
    },
  })),
  BottomSheetModal: ({ children }: any) => children,
}));

describe('TextEditBottomSheet', () => {
  const defaultProps = {
    visible: true,
    title: 'Edit Name',
    initialValue: 'Test Value',
    fieldKey: 'name',
    onSave: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the provided title', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    expect(screen.getByText('Edit Name')).toBeTruthy();
  });

  it('renders Cancel and Save buttons', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders with initial value in the input', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    expect(screen.getByDisplayValue('Test Value')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders label when provided', () => {
    render(<TextEditBottomSheet {...defaultProps} label="Your Name" />);
    expect(screen.getByText('Your Name')).toBeTruthy();
  });

  it('does not render label when not provided', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    expect(screen.queryByText('Your Name')).toBeNull();
  });

  it('renders with placeholder text', () => {
    render(
      <TextEditBottomSheet {...defaultProps} placeholder="Enter a name..." />,
    );
    expect(screen.getByPlaceholderText('Enter a name...')).toBeTruthy();
  });

  it('has accessibility labels on Cancel and Save', () => {
    render(<TextEditBottomSheet {...defaultProps} />);
    expect(screen.getByLabelText('Cancel')).toBeTruthy();
    expect(screen.getByLabelText('Save')).toBeTruthy();
  });

  it('renders correctly when not visible', () => {
    const { toJSON } = render(
      <TextEditBottomSheet {...defaultProps} visible={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
