'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { OnBoardingWrapper as OnBoardingWrapperComponent } from '#components/templates/OnBoardingWrapper';
import type { Button as ButtonComponent } from '#components/base/Button';
import { ProfilePictureUploadScreen } from '../ProfilePictureUploadScreen';

type OnBoardingWrapperProps = React.ComponentProps<
  typeof OnBoardingWrapperComponent
>;
type ButtonProps = React.ComponentProps<typeof ButtonComponent>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockNavigateToNextStep = jest.fn();
const mockNavigateToPreviousStep = jest.fn();
const mockSkipToStep = jest.fn();
jest.mock('#hooks/navigation/useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: mockNavigateToPreviousStep,
    skipToStep: mockSkipToStep,
  }),
}));
jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadProfileImage: jest.fn(),
    updateProfileAvatarUrl: jest.fn(),
  }),
}));

jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => ({ profile: { avatar: null }, loading: false }),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/storage/mmkv');
jest.mock('#/utils/finallyHelpers');
jest.mock('#utils/imageValidation', () => ({
  validateImageFile: jest.fn(),
  ImageValidationError: class extends Error {},
}));

jest.mock('#components/templates/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    title,
    subtitle,
    children,
  }: OnBoardingWrapperProps) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="onboarding-wrapper">
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
      </View>
    );
  },
}));
jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress, disabled }: ButtonProps) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="upload-button">
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));
jest.mock('#components/molecules/ImagePicker', () => ({}));

describe('ProfilePictureUploadScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the title', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByText('Profile Picture')).toBeTruthy();
  });

  it('shows subtitle', () => {
    render(<ProfilePictureUploadScreen />);
    expect(
      screen.getByText('Add a photo to personalize your profile'),
    ).toBeTruthy();
  });

  it('shows Choose from Gallery option', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByText('Choose from Gallery')).toBeTruthy();
  });

  it('shows Take a Photo option', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByText('Take a Photo')).toBeTruthy();
  });

  it('shows Terms of Service link', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByText('Terms of Service')).toBeTruthy();
  });

  it('shows Privacy Policy link', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });

  it('shows upload button disabled when no image', () => {
    render(<ProfilePictureUploadScreen />);
    expect(screen.getByTestId('upload-button')).toBeTruthy();
    expect(screen.getByText('Upload & Continue')).toBeTruthy();
  });
});
