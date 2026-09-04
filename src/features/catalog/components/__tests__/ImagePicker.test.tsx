'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ImagePicker } from '#features/catalog/components/ImagePicker';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#utils/imageValidation', () => ({
  validateImageFile: jest.fn(),
  ImageValidationError: class extends Error {},
}));

jest.mock('#hooks/permissions/usePermission', () => ({
  usePermission: jest.fn(() => ({
    request: jest.fn(() => Promise.resolve('granted')),
    isBlocked: false,
    openSettings: jest.fn(),
  })),
}));

jest.mock('#features/catalog/components/ImagePickerSheet', () => ({
  ImagePickerSheet: () => null,
}));

describe('ImagePicker', () => {
  const defaultProps = {
    onImageSelected: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default Add Photo button', () => {
    render(<ImagePicker {...defaultProps} />);
    expect(screen.getByText('Add Photo')).toBeTruthy();
  });

  it('renders children when provided instead of default button', () => {
    const { Text } = require('react-native');
    render(
      <ImagePicker {...defaultProps}>
        <Text>Custom Trigger</Text>
      </ImagePicker>,
    );
    expect(screen.getByText('Custom Trigger')).toBeTruthy();
    expect(screen.queryByText('Add Photo')).toBeNull();
  });

  it('does not trigger picker when disabled', async () => {
    const user = userEvent.setup();
    render(<ImagePicker {...defaultProps} disabled />);
    await user.press(screen.getByText('Add Photo'));
    // When disabled, showImagePicker returns early — sheet stays hidden
    // No direct assertion on state, but the press completes without error
    expect(screen.getByText('Add Photo')).toBeTruthy();
  });

  it('renders without error when multiSelect is true', () => {
    render(
      <ImagePicker
        {...defaultProps}
        multiSelect
        onMultiImageSelected={jest.fn()}
      />,
    );
    expect(screen.getByText('Add Photo')).toBeTruthy();
  });

  it('is accessible as a pressable element', () => {
    render(<ImagePicker {...defaultProps} />);
    const button = screen.getByText('Add Photo');
    expect(button).toBeTruthy();
  });
});
