'use no memo';

import React from 'react';
import type { ComponentProps } from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { ImageCropScreen } from '../ImageCropScreen';

type ImageCropScreenProps = ComponentProps<typeof ImageCropScreen>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGoBack = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({ title, onBack }: { title?: string; onBack?: () => void }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Text>{title}</Text>
      </View>
    );
  },
}));

jest.mock('#utils/imageValidation', () => ({
  MAX_PROFILE_SIZE: 5 * 1024 * 1024,
}));

jest.mock('@react-native-community/image-editor', () => ({
  __esModule: true,
  default: { cropImage: jest.fn().mockResolvedValue({ uri: 'cropped-uri' }) },
}));

jest.mock('#/storage/mmkv');

jest.mock('#/services/errorService');

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest
  .spyOn(Image, 'getSize')
  .mockImplementation(
    (uri: string, success: (width: number, height: number) => void) => {
      success(800, 600);
    },
  );

const defaultProps: ImageCropScreenProps = {
  route: {
    params: {
      imageFile: {
        uri: 'file://test-image.jpg',
        fileName: 'test.jpg',
        fileSize: 500000,
        type: 'image/jpeg',
      },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ImageCropScreen', () => {
  it('renders crop photo title', () => {
    const { getAllByText } = render(<ImageCropScreen {...defaultProps} />);
    // Title and button both have 'Crop Photo' text
    expect(getAllByText('Crop Photo').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading instructions initially', () => {
    const { getByText } = render(<ImageCropScreen {...defaultProps} />);
    expect(getByText('Loading image...')).toBeTruthy();
  });

  it('renders crop button', () => {
    const { getAllByText } = render(<ImageCropScreen {...defaultProps} />);
    // The button and header both say 'Crop Photo'
    expect(getAllByText('Crop Photo').length).toBeGreaterThanOrEqual(2);
  });

  it('renders back button', () => {
    const { getByTestId } = render(<ImageCropScreen {...defaultProps} />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('navigates back when back pressed', async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<ImageCropScreen {...defaultProps} />);
    await user.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
