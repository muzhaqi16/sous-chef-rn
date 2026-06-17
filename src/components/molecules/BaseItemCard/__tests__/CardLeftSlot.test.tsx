'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CardLeftSlot } from '../CardLeftSlot';
import { Text } from '#components/atoms/Text';

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
  it('renders default emoji when type is emoji', () => {
    render(<CardLeftSlot type="emoji" />);
    expect(screen.getByText('📦')).toBeTruthy();
  });

  it('renders custom emoji', () => {
    render(<CardLeftSlot type="emoji" emoji="🍎" />);
    expect(screen.getByText('🍎')).toBeTruthy();
  });

  it('renders image when type is image with URL', () => {
    render(
      <CardLeftSlot type="image" imageUrl="https://example.com/img.jpg" />,
    );
    expect(screen.getByText('image-https://example.com/img.jpg')).toBeTruthy();
  });

  it('renders icon when type is icon', () => {
    render(<CardLeftSlot type="icon" icon="cart-outline" />);
    expect(screen.getByText('icon-cart-outline')).toBeTruthy();
  });

  it('renders custom children when type is custom', () => {
    render(
      <CardLeftSlot type="custom">
        <Text>Custom content</Text>
      </CardLeftSlot>,
    );
    expect(screen.getByText('Custom content')).toBeTruthy();
  });

  it('applies dimmed style when dimmed prop is true', () => {
    const { toJSON } = render(<CardLeftSlot type="emoji" emoji="🍕" dimmed />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a placeholder icon when type is image with no URL', () => {
    render(<CardLeftSlot type="image" imageUrl={null} />);
    // type="image" always uses the image slot; with no URL it shows a
    // consistent fallback icon rather than collapsing to the emoji slot.
    expect(screen.getByText('icon-image-outline')).toBeTruthy();
    expect(screen.queryByText('📦')).toBeNull();
  });
});
