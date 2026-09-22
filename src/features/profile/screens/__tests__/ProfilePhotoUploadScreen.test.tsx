'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import { ProfilePhotoUploadScreen } from '../ProfilePhotoUploadScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
    navigation: { dispatch: mockDispatch },
    goBack: mockGoBack,
    toImageCrop: jest.fn(),
  })),
}));

const mockUploadProfileImage = jest
  .fn()
  .mockResolvedValue('https://example.com/photo.jpg');
const mockUpdateProfileAvatarUrl = jest.fn().mockResolvedValue(true);
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({
    uploadProfileImage: mockUploadProfileImage,
    updateProfileAvatarUrl: mockUpdateProfileAvatarUrl,
  })),
}));

jest.mock('#utils/imageValidation', () => ({
  validateImageFile: jest.fn(),
  ImageValidationError: class extends Error {},
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: { CAMERA: 'ios.permission.CAMERA' },
    ANDROID: { CAMERA: 'android.permission.CAMERA' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
  },
}));

jest.mock('#/storage/mmkv');

jest.mock('#/services/errorService');

jest.mock('#/utils/finallyHelpers');

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#features/catalog/components/ImagePicker', () => ({
  ImageFile: {},
}));

describe('ProfilePhotoUploadScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the upload screen with title', () => {
    const { getByText } = render(<ProfilePhotoUploadScreen />);
    expect(getByText('Upload Your Photo')).toBeTruthy();
  });

  it('shows initial subtitle when no image selected', () => {
    const { getByText } = render(<ProfilePhotoUploadScreen />);
    expect(
      getByText('Choose a profile picture to personalize your account.'),
    ).toBeTruthy();
  });

  it('shows Take Photo and Select Photo buttons initially', () => {
    const { getByText } = render(<ProfilePhotoUploadScreen />);
    expect(getByText('Take Photo')).toBeTruthy();
    expect(getByText('Select Photo')).toBeTruthy();
  });

  it('closes rather than goes back, being presented from the bottom', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = render(<ProfilePhotoUploadScreen />);
    expect(queryByTestId(kitTestIDs.headerBackButton)).toBeNull();
    await user.press(getByTestId(kitTestIDs.headerCloseButton));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders snapshot with default state', () => {
    const tree = render(<ProfilePhotoUploadScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });
});
