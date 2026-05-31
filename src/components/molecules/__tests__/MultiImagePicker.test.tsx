'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MultiImagePicker, type SelectedImage } from '../MultiImagePicker';
import type { ImageFile } from '../ImagePicker';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#utils/imageUtils', () => ({
  getPerspectiveLabel: jest.fn((perspective: string) => {
    const labels: Record<string, string> = {
      front: 'Front',
      back: 'Back',
      left: 'Left',
      right: 'Right',
      nutrition_label: 'Nutrition Label',
      ingredient_list: 'Ingredient List',
    };
    return labels[perspective] || perspective;
  }),
}));

jest.mock('../ImagePicker', () => ({
  ImagePicker: ({
    children,
    onImageSelected,
  }: {
    children?: React.ReactNode;
    onImageSelected?: (image: ImageFile) => void;
  }) => {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID="image-picker"
        onPress={() =>
          onImageSelected?.({
            uri: 'file://new-image.jpg',
            type: 'image/jpeg',
            fileName: 'new.jpg',
          })
        }
      >
        {children}
      </Pressable>
    );
  },
}));

jest.mock('../ModalPicker', () => ({
  ModalPicker: ({
    visible,
    label,
    options,
    onSelect,
  }: {
    visible: boolean;
    label: string;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="modal-picker">
        <Text>{label}</Text>
        {options.map(opt => (
          <Pressable key={opt.value} onPress={() => onSelect(opt.value)}>
            <Text>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

const defaultProps = {
  images: [] as SelectedImage[],
  onImagesChanged: jest.fn(),
};

describe('MultiImagePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the default label', () => {
    render(<MultiImagePicker {...defaultProps} />);
    expect(screen.getByText('Product Images')).toBeTruthy();
  });

  it('renders a custom label', () => {
    render(<MultiImagePicker {...defaultProps} label="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeTruthy();
  });

  it('shows placeholder when no images selected', () => {
    render(<MultiImagePicker {...defaultProps} />);
    expect(screen.getByText('Add Photos')).toBeTruthy();
    expect(screen.getByText('Select up to 6 images')).toBeTruthy();
  });

  it('shows custom max images in placeholder', () => {
    render(<MultiImagePicker {...defaultProps} maxImages={3} />);
    expect(screen.getByText('Select up to 3 images')).toBeTruthy();
  });

  it('renders images when provided', () => {
    const images: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
      },
      {
        uri: 'file://img2.jpg',
        type: 'image/jpeg',
        fileName: 'img2.jpg',
        perspective: 'back',
      },
    ];
    render(<MultiImagePicker {...defaultProps} images={images} />);
    expect(screen.getByText('Product Images (2/6)')).toBeTruthy();
  });

  it('shows perspective labels for each image', () => {
    const images: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
      },
      {
        uri: 'file://img2.jpg',
        type: 'image/jpeg',
        fileName: 'img2.jpg',
        perspective: 'back',
      },
    ];
    render(<MultiImagePicker {...defaultProps} images={images} />);
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();
  });

  it('shows Add More button when under max images', () => {
    const images: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
      },
    ];
    render(<MultiImagePicker {...defaultProps} images={images} />);
    expect(screen.getByText('Add More')).toBeTruthy();
  });

  it('does not show Add More button when at max images', () => {
    const images: SelectedImage[] = Array.from({ length: 6 }, (_, i) => ({
      uri: `file://img${i}.jpg`,
      type: 'image/jpeg',
      fileName: `img${i}.jpg`,
      perspective: 'front',
    }));
    render(<MultiImagePicker {...defaultProps} images={images} />);
    expect(screen.queryByText('Add More')).toBeNull();
  });

  it('renders remove buttons with correct accessibility label', () => {
    const images: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
      },
    ];
    render(<MultiImagePicker {...defaultProps} images={images} />);
    expect(screen.getByLabelText('Remove image')).toBeTruthy();
  });
});
