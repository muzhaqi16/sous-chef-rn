'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ImageUploadField } from '../ImageUploadField';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

let mockImagePickerOnImageSelected: any = null;
jest.mock('../ImagePicker', () => ({
  ImagePicker: ({ children, onImageSelected }: any) => {
    mockImagePickerOnImageSelected = onImageSelected;
    return children;
  },
}));

const mockUploadProfileImage = jest.fn();
const mockUploadItemImage = jest.fn();
let mockUploading = false;
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploading: mockUploading,
    uploadProfileImage: mockUploadProfileImage,
    uploadItemImage: mockUploadItemImage,
  }),
}));

jest.mock('#/utils/compilerSafeWrappers');
const { executeAsyncWithCleanup: mockExecuteAsyncWithCleanup } =
  jest.requireMock('#/utils/compilerSafeWrappers') as {
    executeAsyncWithCleanup: jest.Mock;
  };

describe('ImageUploadField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploading = false;
    mockImagePickerOnImageSelected = null;
  });

  it('renders default placeholder when no image', () => {
    render(<ImageUploadField />);
    expect(screen.getByText('No image selected')).toBeTruthy();
  });

  it('renders custom placeholder text', () => {
    render(<ImageUploadField placeholder="Tap to upload" />);
    expect(screen.getByText('Tap to upload')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<ImageUploadField label="Photo" />);
    expect(screen.getByText('Photo')).toBeTruthy();
  });

  it('does not render label when not provided', () => {
    const { toJSON } = render(<ImageUploadField />);
    expect(toJSON()).toBeTruthy();
    expect(screen.queryByText('Photo')).toBeNull();
  });

  it('renders required marker when required', () => {
    render(<ImageUploadField label="Photo" required />);
    expect(screen.getByText(/\*/)).toBeTruthy();
  });

  it('does not render required marker when not required', () => {
    render(<ImageUploadField label="Photo" />);
    expect(screen.queryByText(' *')).toBeNull();
  });

  it('renders image preview when value is provided', () => {
    render(<ImageUploadField value="https://example.com/image.jpg" />);
    // When there is an image, we should not see placeholder
    expect(screen.queryByText('No image selected')).toBeNull();
  });

  it('renders camera icon in placeholder state', () => {
    render(<ImageUploadField />);
    expect(screen.getByText('camera-outline')).toBeTruthy();
  });

  it('renders edit and delete buttons when image is present and not uploading', () => {
    render(<ImageUploadField value="https://example.com/image.jpg" />);
    expect(screen.getByText('create-outline')).toBeTruthy();
    expect(screen.getByText('trash-outline')).toBeTruthy();
  });

  it('calls onImageUploaded with empty string when remove is pressed', async () => {
    const user = userEvent.setup();
    const onImageUploaded = jest.fn();
    render(
      <ImageUploadField
        value="https://example.com/image.jpg"
        onImageUploaded={onImageUploaded}
      />,
    );
    await user.press(screen.getByText('trash-outline'));
    expect(onImageUploaded).toHaveBeenCalledWith('');
  });

  it('triggers upload on image selection with itemId', () => {
    render(<ImageUploadField itemId="item-1" />);
    const mockImage = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };
    mockImagePickerOnImageSelected(mockImage);
    expect(mockExecuteAsyncWithCleanup).toHaveBeenCalled();
  });

  it('triggers upload on image selection with profilePurpose', () => {
    render(<ImageUploadField isProfile profilePurpose={'AVATAR' as any} />);
    const mockImage = { uri: 'file://photo.jpg', fileName: 'photo.jpg' };
    mockImagePickerOnImageSelected(mockImage);
    expect(mockExecuteAsyncWithCleanup).toHaveBeenCalled();
  });

  it('shows uploading text in placeholder when uploading', () => {
    mockUploading = true;
    render(<ImageUploadField />);
    expect(screen.getByText('Uploading...')).toBeTruthy();
  });

  it('renders profile image style when isProfile is true and has image', () => {
    const { toJSON } = render(
      <ImageUploadField value="https://example.com/image.jpg" isProfile />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
