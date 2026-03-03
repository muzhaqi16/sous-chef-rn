import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import {
  OverlayBackdropProvider,
  useOverlayBackdrop,
  GlobalBackdrop,
} from '../OverlayBackdropProvider';

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((fn: any) => {
    fn(false);
    return fn;
  }),
}));

jest.mock('#constants/animations', () => ({
  SHEET: { BACKDROP_FADE_IN: 200, BACKDROP_FADE_OUT: 150 },
}));

// Consumer component to test the context
const ContextConsumer: React.FC = () => {
  const { showBackdrop, hideBackdrop } = useOverlayBackdrop();
  return (
    <View>
      <Pressable onPress={() => showBackdrop()} testID="show-btn">
        <Text>Show</Text>
      </Pressable>
      <Pressable onPress={() => hideBackdrop()} testID="hide-btn">
        <Text>Hide</Text>
      </Pressable>
    </View>
  );
};

describe('OverlayBackdropProvider', () => {
  it('renders children', () => {
    render(
      <OverlayBackdropProvider>
        <Text>Child content</Text>
      </OverlayBackdropProvider>,
    );
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('provides showBackdrop and hideBackdrop via context', () => {
    render(
      <OverlayBackdropProvider>
        <ContextConsumer />
      </OverlayBackdropProvider>,
    );
    expect(screen.getByText('Show')).toBeTruthy();
    expect(screen.getByText('Hide')).toBeTruthy();
  });

  it('does not throw when showBackdrop is called', () => {
    render(
      <OverlayBackdropProvider>
        <ContextConsumer />
      </OverlayBackdropProvider>,
    );
    expect(() => {
      fireEvent.press(screen.getByTestId('show-btn'));
    }).not.toThrow();
  });

  it('does not throw when hideBackdrop is called', () => {
    render(
      <OverlayBackdropProvider>
        <ContextConsumer />
      </OverlayBackdropProvider>,
    );
    expect(() => {
      fireEvent.press(screen.getByTestId('hide-btn'));
    }).not.toThrow();
  });
});

describe('useOverlayBackdrop', () => {
  it('throws when used outside OverlayBackdropProvider', () => {
    const BadConsumer: React.FC = () => {
      useOverlayBackdrop();
      return null;
    };

    expect(() => render(<BadConsumer />)).toThrow(
      'useOverlayBackdrop must be used within OverlayBackdropProvider',
    );
  });
});

describe('GlobalBackdrop', () => {
  it('renders nothing when used outside provider', () => {
    const { toJSON } = render(<GlobalBackdrop />);
    expect(toJSON()).toBeNull();
  });

  it('renders when used inside provider', () => {
    const { toJSON } = render(
      <OverlayBackdropProvider>
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
