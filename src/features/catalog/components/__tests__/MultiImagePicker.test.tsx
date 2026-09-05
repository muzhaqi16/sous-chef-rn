'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  MultiImagePicker,
  type SelectedImage,
} from '#features/catalog/components/MultiImagePicker';
import type { ImageFile } from '#/types/media';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#features/catalog/components/ImagePicker', () => ({
  ImagePicker: ({
    children,
    onImageSelected,
    onMultiImageSelected,
  }: {
    children?: React.ReactNode;
    onImageSelected?: (image: ImageFile) => void;
    onMultiImageSelected?: (images: ImageFile[]) => void;
  }) => {
    const { Pressable } = require('react-native');
    return (
      <>
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
        <Pressable
          testID="image-picker-multi"
          onPress={() =>
            onMultiImageSelected?.(
              Array.from({ length: 4 }, (_, i) => ({
                uri: `file://multi-${i}.jpg`,
                type: 'image/jpeg',
                fileName: `multi-${i}.jpg`,
              })),
            )
          }
        />
      </>
    );
  },
}));

jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: ({
    visible,
    label,
    options,
    onSelect,
    stackBehavior,
  }: {
    visible: boolean;
    label: string;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
    stackBehavior?: string;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="modal-picker" accessibilityValue={{ text: stackBehavior }}>
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

  it('pushes the perspective picker so its host sheet is not minimized', () => {
    const images: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
      },
    ];
    render(<MultiImagePicker {...defaultProps} images={images} />);
    fireEvent.press(screen.getByLabelText('Change image perspective'));
    expect(screen.getByTestId('modal-picker')).toHaveAccessibilityValue({
      text: 'push',
    });
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

  // Perspectives now ride the upload to confirmItemImageUpload, so a collision
  // is persisted catalog data — three photos filed as "Back" — not just a
  // mislabeled row in this picker.
  it('assigns a distinct perspective to every image in one multi-select', () => {
    const onImagesChanged = jest.fn();
    render(
      <MultiImagePicker
        {...defaultProps}
        images={[]}
        onImagesChanged={onImagesChanged}
      />,
    );

    fireEvent.press(screen.getByTestId('image-picker-multi'));

    const assigned = onImagesChanged.mock.calls[0][0] as SelectedImage[];
    const perspectives = assigned.map(image => image.perspective);
    expect(perspectives).toEqual(['front', 'back', 'left', 'right']);
    expect(new Set(perspectives).size).toBe(perspectives.length);
  });

  // The star reaches confirmItemImageUpload as `makePrimary`, so it repoints
  // the item's hero for every viewer — not a local preview flag.
  describe('primary selection', () => {
    const twoImages: SelectedImage[] = [
      {
        uri: 'file://img1.jpg',
        type: 'image/jpeg',
        fileName: 'img1.jpg',
        perspective: 'front',
        isPrimary: true,
      },
      {
        uri: 'file://img2.jpg',
        type: 'image/jpeg',
        fileName: 'img2.jpg',
        perspective: 'back',
      },
    ];

    // The suggestion path lands photos PENDING and the server drops
    // makePrimary, so the affordance must stay off unless a host opts in.
    it('offers no star by default', () => {
      render(<MultiImagePicker {...defaultProps} images={twoImages} />);
      expect(screen.queryByLabelText('Set as main photo')).toBeNull();
      expect(screen.queryByLabelText('Main photo')).toBeNull();
    });

    it('seeds the first image as primary when images are added', () => {
      const onImagesChanged = jest.fn();
      render(
        <MultiImagePicker
          {...defaultProps}
          images={[]}
          onImagesChanged={onImagesChanged}
          allowPrimarySelection
        />,
      );

      fireEvent.press(screen.getByTestId('image-picker-multi'));

      const assigned = onImagesChanged.mock.calls[0][0] as SelectedImage[];
      expect(assigned.map(image => !!image.isPrimary)).toEqual([
        true,
        false,
        false,
        false,
      ]);
    });

    it('moves the flag exclusively to the tapped image', () => {
      const onImagesChanged = jest.fn();
      render(
        <MultiImagePicker
          {...defaultProps}
          images={twoImages}
          onImagesChanged={onImagesChanged}
          allowPrimarySelection
        />,
      );

      fireEvent.press(screen.getByLabelText('Set as main photo'));

      const updated = onImagesChanged.mock.calls[0][0] as SelectedImage[];
      expect(updated.map(image => !!image.isPrimary)).toEqual([false, true]);
    });

    // Without the re-seed the batch uploads with no makePrimary at all and the
    // item silently keeps whatever hero it already had.
    it('re-seeds the flag when the primary image is removed', () => {
      const onImagesChanged = jest.fn();
      render(
        <MultiImagePicker
          {...defaultProps}
          images={twoImages}
          onImagesChanged={onImagesChanged}
          allowPrimarySelection
        />,
      );

      fireEvent.press(screen.getAllByLabelText('Remove image')[0]);

      const updated = onImagesChanged.mock.calls[0][0] as SelectedImage[];
      expect(updated).toHaveLength(1);
      expect(updated[0].isPrimary).toBe(true);
    });
  });
});
