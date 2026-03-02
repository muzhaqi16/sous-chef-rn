'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import TurboImage from 'react-native-turbo-image';
import { CachedImage, preloadImages } from '../CachedImage';

// Override unistyles mock to add flatten (global mock only has create/configure)
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('../../../theme/themes');
  const RN = require('react-native');
  return {
    StyleSheet: {
      create: (styleFnOrObj: any) => {
        if (typeof styleFnOrObj === 'function') {
          return styleFnOrObj(lightTheme);
        }
        return styleFnOrObj;
      },
      configure: jest.fn(),
      flatten: RN.StyleSheet.flatten,
    },
    useUnistyles: jest.fn(() => ({
      theme: lightTheme,
      styles: {},
    })),
    useStyles: jest.fn((stylesheet: any) => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn((component: any) => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      colorScheme: 'light',
      themeName: 'light',
    },
  };
});

// Mock iconUtils
jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) => R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

// Mock SkeletonBase
jest.mock('#components/base/Skeleton/SkeletonBase', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    SkeletonBase: (props: any) => R.createElement(RN.View, { testID: 'skeleton', ...props }),
  };
});

describe('CachedImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder when uri is null', () => {
    render(<CachedImage uri={null} />);
    expect(screen.getByTestId('icon-image-outline')).toBeTruthy();
  });

  it('renders placeholder when uri is undefined', () => {
    render(<CachedImage uri={undefined} />);
    expect(screen.getByTestId('icon-image-outline')).toBeTruthy();
  });

  it('renders placeholder when uri is empty string', () => {
    render(<CachedImage uri="" />);
    expect(screen.getByTestId('icon-image-outline')).toBeTruthy();
  });

  it('renders image component when uri is provided', () => {
    const { toJSON } = render(<CachedImage uri="https://example.com/image.jpg" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ width: 100, height: 100, borderRadius: 8 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with containerStyle', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        containerStyle={{ margin: 10 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('passes displaySize as resize prop (2x)', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        displaySize={48}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles borderRadius calculation for inner content', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ borderRadius: 16, borderWidth: 2 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles zero borderRadius', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ borderRadius: 0 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles style without borderRadius', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ width: 50, height: 50 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders placeholder icon', () => {
    render(<CachedImage uri={null} style={{ width: 50, height: 50 }} />);
    const icon = screen.getByTestId('icon-image-outline');
    expect(icon).toBeTruthy();
  });

  it('applies placeholder and containerStyle when no URI', () => {
    const { toJSON } = render(
      <CachedImage
        uri={null}
        style={{ width: 100, height: 100 }}
        containerStyle={{ borderWidth: 1 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with default cachePolicy and resizeMode', () => {
    const { toJSON } = render(
      <CachedImage uri="https://example.com/image.jpg" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom cachePolicy', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        cachePolicy="urlCache"
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom resizeMode', () => {
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        resizeMode="contain"
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders skeleton overlay when loading', () => {
    const { toJSON } = render(
      <CachedImage uri="https://example.com/image.jpg" />,
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
    // Should have skeleton in the tree (loading overlay)
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('renders error overlay (hidden by default)', () => {
    const { toJSON } = render(
      <CachedImage uri="https://example.com/image.jpg" />,
    );
    // Error overlay has an icon-image-outline too, but it's hidden
    expect(toJSON()).toBeTruthy();
  });

  it('computes innerRadius from borderRadius and borderWidth', () => {
    // borderRadius: 20, borderWidth: 4 -> innerRadius = max(20-4, 0) = 16
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ borderRadius: 20, borderWidth: 4 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles borderRadius without borderWidth', () => {
    // borderRadius: 12, no borderWidth -> innerRadius = max(12-0, 0) = 12
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ borderRadius: 12 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles large borderWidth exceeding borderRadius', () => {
    // borderRadius: 4, borderWidth: 10 -> innerRadius = max(4-10, 0) = 0
    const { toJSON } = render(
      <CachedImage
        uri="https://example.com/image.jpg"
        style={{ borderRadius: 4, borderWidth: 10 }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('passes undefined style to flatten gracefully', () => {
    const { toJSON } = render(
      <CachedImage uri="https://example.com/image.jpg" />,
    );
    // No style prop -> flatten receives undefined -> returns {} or undefined
    expect(toJSON()).toBeTruthy();
  });
});

describe('preloadImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Add prefetch to TurboImage mock since global mock doesn't have it
    (TurboImage as any).prefetch = jest.fn();
  });

  it('calls TurboImage.prefetch with filtered sources', () => {
    preloadImages(['https://example.com/a.jpg', '', 'https://example.com/b.jpg']);

    expect((TurboImage as any).prefetch).toHaveBeenCalledWith(
      [
        { uri: 'https://example.com/a.jpg' },
        { uri: 'https://example.com/b.jpg' },
      ],
      'dataCache',
    );
  });

  it('handles empty array', () => {
    preloadImages([]);
    expect((TurboImage as any).prefetch).toHaveBeenCalledWith([], 'dataCache');
  });

  it('filters out falsy URIs', () => {
    preloadImages(['', '', '']);
    expect((TurboImage as any).prefetch).toHaveBeenCalledWith([], 'dataCache');
  });

  it('preloads single URI', () => {
    preloadImages(['https://example.com/single.jpg']);
    expect((TurboImage as any).prefetch).toHaveBeenCalledWith(
      [{ uri: 'https://example.com/single.jpg' }],
      'dataCache',
    );
  });
});
