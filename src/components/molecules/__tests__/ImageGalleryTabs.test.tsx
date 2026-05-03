'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ImageGalleryTabs } from '../ImageGalleryTabs';

jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, `icon-${name}`);
  },
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({ uri }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(
      Text,
      { testID: 'cached-image' },
      `img-${uri}`,
    );
  },
}));

jest.mock('#utils/imageUtils', () => ({
  parseImages: jest.fn(() => []),
  groupImagesByPerspective: jest.fn((images: any[]) => {
    if (images.length === 0) return [];
    return [{ key: 'front', images }];
  }),
  getBestImageUrl: jest.fn((image: any) => image.url || 'mock-url'),
  getPrimaryImage: jest.fn((images: any[]) => images[0] || null),
  hasImages: jest.fn((images: any[]) => images.length > 0),
}));

describe('ImageGalleryTabs', () => {
  it('renders placeholder when no images and no fallback', () => {
    render(<ImageGalleryTabs images={[]} />);
    expect(screen.getByText('icon-image-outline')).toBeTruthy();
  });

  it('renders fallback image when provided with no images', () => {
    render(
      <ImageGalleryTabs
        images={[]}
        fallbackImageUrl="https://example.com/fallback.jpg"
      />,
    );
    expect(screen.getByTestId('cached-image')).toBeTruthy();
  });

  it('renders image from parsed images array', () => {
    const images = [
      { url: 'https://example.com/front.jpg', perspective: 'front' },
    ];
    const {
      hasImages,
      groupImagesByPerspective,
      getBestImageUrl,
    } = require('#utils/imageUtils');
    hasImages.mockReturnValue(true);
    groupImagesByPerspective.mockReturnValue([{ key: 'front', images }]);
    getBestImageUrl.mockReturnValue('https://example.com/front.jpg');

    render(<ImageGalleryTabs images={images} />);
    expect(screen.getByTestId('cached-image')).toBeTruthy();
  });

  it('renders with custom height', () => {
    const { toJSON } = render(
      <ImageGalleryTabs images={[]} imageHeight={300} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { toJSON } = render(
      <ImageGalleryTabs images={[]} style={{ margin: 10 }} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
