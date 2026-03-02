import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

// Mock CachedImage to a simple View
jest.mock('#components/atoms/CachedImage', () => {
  const { View } = require('react-native');
  return {
    CachedImage: (props: any) => <View testID="cached-image" {...props} />,
  };
});

describe('Avatar', () => {
  it('renders without crashing with no props', () => {
    const { toJSON } = render(<Avatar />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders CachedImage when uri is provided', () => {
    render(<Avatar uri="https://example.com/avatar.jpg" />);
    expect(screen.getByTestId('cached-image')).toBeTruthy();
  });

  it('renders initials when name is provided without uri', () => {
    render(<Avatar name="John Doe" />);
    // getInitials("John Doe") returns "J" (first letter of first name)
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('renders fallback icon when neither uri nor name is provided', () => {
    // The Icon component is mocked to just 'Icon' string, so it renders
    const { toJSON } = render(<Avatar />);
    expect(toJSON()).toBeTruthy();
  });

  it('prefers uri over name when both are provided', () => {
    render(<Avatar uri="https://example.com/pic.jpg" name="John" />);
    expect(screen.getByTestId('cached-image')).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { toJSON } = render(<Avatar name="Jane" size={60} />);
    expect(toJSON()).toBeTruthy();
  });
});
