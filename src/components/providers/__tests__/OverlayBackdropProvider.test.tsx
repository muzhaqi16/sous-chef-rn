import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import {
  OverlayBackdropProvider,
  useOverlayBackdrop,
  useBackdropClaim,
  GlobalBackdrop,
} from '../OverlayBackdropProvider';

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((fn: any, ...args: any[]) => fn(...args)),
}));

jest.mock('#constants/animations', () => ({
  SHEET: { BACKDROP_FADE_IN: 200, BACKDROP_FADE_OUT: 150 },
}));

const mockListeners: Record<string, Array<() => void>> = {};
jest.mock('#services/NavigationService', () => ({
  navigationRef: {
    addListener: jest.fn((event: string, cb: () => void) => {
      mockListeners[event] = mockListeners[event] || [];
      mockListeners[event].push(cb);
      return () => {
        const arr = mockListeners[event] || [];
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      };
    }),
  },
}));

const fireNavState = () => {
  (mockListeners.state || []).forEach(cb => cb());
};

beforeEach(() => {
  Object.keys(mockListeners).forEach(k => delete mockListeners[k]);
});

const ImperativeConsumer: React.FC = () => {
  const { claim, release } = useOverlayBackdrop();
  const idRef = React.useRef<string | null>(null);
  return (
    <View>
      <Pressable
        testID="claim-btn"
        onPress={() => {
          idRef.current = claim({ opacity: 0.5 });
        }}
      >
        <Text>Claim</Text>
      </Pressable>
      <Pressable
        testID="release-btn"
        onPress={() => {
          if (idRef.current) {
            release(idRef.current);
            idRef.current = null;
          }
        }}
      >
        <Text>Release</Text>
      </Pressable>
    </View>
  );
};

const DeclarativeConsumer: React.FC<{ active: boolean }> = ({ active }) => {
  useBackdropClaim(active, { opacity: 0.5 });
  return <Text>declarative</Text>;
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

  it('exposes claim/release via context', () => {
    render(
      <OverlayBackdropProvider>
        <ImperativeConsumer />
      </OverlayBackdropProvider>,
    );
    expect(screen.getByText('Claim')).toBeTruthy();
    expect(screen.getByText('Release')).toBeTruthy();
  });

  it('does not throw when claim/release are called', () => {
    render(
      <OverlayBackdropProvider>
        <ImperativeConsumer />
      </OverlayBackdropProvider>,
    );
    expect(() => {
      fireEvent.press(screen.getByTestId('claim-btn'));
      fireEvent.press(screen.getByTestId('release-btn'));
    }).not.toThrow();
  });

  it('makes the backdrop interactive while a declarative claim is active', () => {
    const { rerender, UNSAFE_getByType } = render(
      <OverlayBackdropProvider>
        <DeclarativeConsumer active={false} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    // active=false → pointerEvents should be 'none'
    let backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('none');

    rerender(
      <OverlayBackdropProvider>
        <DeclarativeConsumer active={true} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('auto');
  });

  it('releases when the consumer unmounts (no manual hide call required)', () => {
    const { rerender, UNSAFE_getByType } = render(
      <OverlayBackdropProvider>
        <DeclarativeConsumer active={true} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    let backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('auto');

    // Consumer unmounts → effect cleanup → release → backdrop hides.
    rerender(
      <OverlayBackdropProvider>
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('none');
  });

  it('keeps the backdrop active while at least one claim remains', () => {
    const Two: React.FC<{ a: boolean; b: boolean }> = ({ a, b }) => (
      <>
        {!!a && <DeclarativeConsumer active={true} />}
        {!!b && <DeclarativeConsumer active={true} />}
      </>
    );

    const { rerender, UNSAFE_getByType } = render(
      <OverlayBackdropProvider>
        <Two a={true} b={true} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    let backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('auto');

    // Drop one claim — still one left.
    rerender(
      <OverlayBackdropProvider>
        <Two a={false} b={true} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );
    backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('auto');

    // Drop the second — backdrop hides.
    rerender(
      <OverlayBackdropProvider>
        <Two a={false} b={false} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );
    backdrop = UNSAFE_getByType(
      require('react-native-reanimated').default.View,
    );
    expect(backdrop.props.pointerEvents).toBe('none');
  });

  it('clears all claims on a navigation state change', () => {
    render(
      <OverlayBackdropProvider>
        <DeclarativeConsumer active={true} />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    const reanimated = require('react-native-reanimated').default;
    let backdrop = screen.UNSAFE_getByType(reanimated.View);
    expect(backdrop.props.pointerEvents).toBe('auto');
    expect(mockListeners.state?.length ?? 0).toBeGreaterThan(0);

    // Simulate React Navigation firing a 'state' event (push or pop).
    act(() => {
      fireNavState();
    });

    backdrop = screen.UNSAFE_getByType(reanimated.View);
    expect(backdrop.props.pointerEvents).toBe('none');
  });

  it('release is a no-op for unknown ids', () => {
    let releaseFn: ((id: string) => void) | null = null;
    const Capture: React.FC = () => {
      const ctx = useOverlayBackdrop();
      useEffect(() => {
        releaseFn = ctx.release;
      }, [ctx]);
      return null;
    };

    render(
      <OverlayBackdropProvider>
        <Capture />
        <GlobalBackdrop />
      </OverlayBackdropProvider>,
    );

    expect(() => releaseFn?.('nonexistent-id')).not.toThrow();
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
