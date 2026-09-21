'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CardLeftSlot } from '../CardLeftSlot';

jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text: RNText } = require('react-native');
    return require('react').createElement(RNText, null, `icon-${name}`);
  },
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    listItemImageContainerCompact: {},
    listItemImageCompact: {},
  },
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({ uri }: { uri: string }) => {
    const { Text: RNText } = require('react-native');
    return require('react').createElement(RNText, null, `image-${uri}`);
  },
}));

describe('CardLeftSlot', () => {
  it('renders the image when there is a URL', () => {
    render(<CardLeftSlot imageUrl="https://example.com/img.jpg" />);
    expect(screen.getByText('image-https://example.com/img.jpg')).toBeTruthy();
  });

  it('renders a placeholder icon when there is no URL', () => {
    render(<CardLeftSlot imageUrl={null} />);
    expect(screen.getByText('icon-image-outline')).toBeTruthy();
  });
});
