import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  ProfileHero,
  type ProfileHeroProps,
} from '#features/profile/components/ProfileHero';

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

const Hero = (props: Omit<ProfileHeroProps, 'scrollY'>) => {
  const scrollY = useSharedValue(0);
  return <ProfileHero {...props} scrollY={scrollY} />;
};

describe('ProfileHero', () => {
  const defaultProps = {
    name: 'John Doe',
    onAvatarPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the name and the subtitle', () => {
    render(<Hero {...defaultProps} subtitle="john@example.com" />);
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('omits the subtitle when none is given', () => {
    render(<Hero {...defaultProps} />);
    expect(screen.queryByText('john@example.com')).toBeNull();
  });

  it('carries no navigation controls of its own', () => {
    render(<Hero {...defaultProps} />);
    expect(screen.queryByLabelText('Go Back')).toBeNull();
    expect(screen.queryByLabelText('More options')).toBeNull();
  });

  it('opens the photo flow from the avatar', async () => {
    const user = userEvent.setup();
    render(<Hero {...defaultProps} />);
    await user.press(screen.getByLabelText('Change photo'));
    expect(defaultProps.onAvatarPress).toHaveBeenCalledTimes(1);
  });

  it('shows the fallback icon when the avatar fails to load', () => {
    render(
      <Hero {...defaultProps} avatarUrl="https://example.com/broken.jpg" />,
    );
    const [image] = screen.UNSAFE_root.findAll(
      node => typeof node.props.onFailure === 'function',
    );
    if (!image) throw new Error('no avatar image rendered');
    fireEvent(image, 'failure');
    expect(
      screen.UNSAFE_getAllByProps({ name: 'image-outline' }).length,
    ).toBeGreaterThan(0);
  });
});
