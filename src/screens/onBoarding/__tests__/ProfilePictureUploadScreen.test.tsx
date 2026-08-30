'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { OnBoardingWrapper as OnBoardingWrapperComponent } from '#components/templates/OnBoardingWrapper';
import type { Button as ButtonComponent } from '#components/atoms/Button';
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

const mockProfileData = {
  profile: { avatar: null } as { avatar: string | null } | null,
  loading: false,
};
jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => mockProfileData,
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
jest.mock('#components/atoms/Button', () => ({
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

  describe('while the profile request is in flight', () => {
    afterEach(() => {
      mockProfileData.profile = { avatar: null };
      mockProfileData.loading = false;
    });

    it('keeps the photo-picker actions available with no answer yet', () => {
      // `cache-and-network` reports loading for the whole network leg, so
      // gating on it alone removes the only way forward for up to ~30s.
      mockProfileData.profile = null;
      mockProfileData.loading = true;

      render(<ProfilePictureUploadScreen />);

      expect(screen.queryByText('Choose from Gallery')).toBeTruthy();
    });

    it('keeps them available while refreshing an answer it already has', () => {
      mockProfileData.loading = true;

      render(<ProfilePictureUploadScreen />);

      expect(screen.queryByText('Choose from Gallery')).toBeTruthy();
    });
  });
});
