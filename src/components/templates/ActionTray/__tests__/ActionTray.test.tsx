'use no memo';
import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { ActionTray } from '../ActionTray';
import type { ActionTrayRef } from '../types';

// The backdrop is driven by the sheet's `animatedIndex` (lockstep dim), so the
// hook returns the `animatedIndex` SV plus `onChange`/`onAnimate` handlers that
// ActionTray composes into gorhom. Stable module-level mocks let tests assert
// the claim (open) and release (close) paths. `mock`-prefixed names are allowed
// inside the hoisted jest.mock factory.
const mockBackdropAnimatedIndex = { value: -1 };
const mockBackdropOnChange = jest.fn();
const mockBackdropOnAnimate = jest.fn();

jest.mock('#hooks/useBottomSheetBackdropClaim', () => ({
  useBottomSheetBackdropClaim: jest.fn(() => ({
    animatedIndex: mockBackdropAnimatedIndex,
    onChange: mockBackdropOnChange,
    onAnimate: mockBackdropOnAnimate,
  })),
}));

describe('ActionTray', () => {
  beforeEach(() => {
    mockBackdropOnChange.mockClear();
    mockBackdropOnAnimate.mockClear();
  });

  // Render an opened tray and capture gorhom's prop handlers. The mock renders
  // BottomSheetModal as a View carrying all props; `detached` uniquely
  // identifies it. Capture the handlers up front — gorhom holds the functions,
  // and the element unmounts as soon as the first close signal lands.
  const openTray = (handlers?: {
    onClose?: () => void;
    onOpen?: () => void;
  }) => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray
        ref={ref}
        onClose={handlers?.onClose}
        onOpen={handlers?.onOpen}
      >
        <Text>Content</Text>
      </ActionTray>,
    );
    act(() => {
      ref.current!.open();
    });
    const modal = screen.UNSAFE_getByProps({ detached: true });
    const { onChange, onDismiss, onAnimate, animatedIndex } = modal.props as {
      onChange: (index: number) => void;
      onDismiss: () => void;
      onAnimate: (fromIndex: number, toIndex: number) => void;
      animatedIndex: { value: number };
    };
    return { ref, onChange, onDismiss, onAnimate, animatedIndex };
  };

  it('renders nothing when not opened', () => {
    const { toJSON } = render(
      <ActionTray>
        <Text>Tray content</Text>
      </ActionTray>,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders children after open', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Tray content</Text>
      </ActionTray>,
    );
    act(() => {
      ref.current!.open();
    });
    expect(screen.getByText('Tray content')).toBeTruthy();
  });

  it('renders with title after open', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref} title="Actions">
        <Text>Content</Text>
      </ActionTray>,
    );
    act(() => {
      ref.current!.open();
    });
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('exposes ref methods', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(ref.current).toBeTruthy();
    expect(ref.current!.open).toBeDefined();
    expect(ref.current!.close).toBeDefined();
    expect(ref.current!.toggle).toBeDefined();
    expect(ref.current!.isActive).toBeDefined();
  });

  it('isActive returns false initially', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(ref.current!.isActive()).toBe(false);
  });

  it('isActive returns true after open', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    act(() => {
      ref.current!.open();
    });
    expect(ref.current!.isActive()).toBe(true);
  });

  it('close() does not throw when called while not open', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(() => ref.current!.close()).not.toThrow();
  });

  // Gorhom skips onChange(-1) entirely when a close interrupts an open
  // animation that never settled (its internal animatedCurrentIndex is still
  // -1, so the settled-closed index "didn't change"); in that path only
  // onDismiss fires, from the modal's unmount(). Keying cleanup off
  // onChange(-1) alone leaked the backdrop claim — `mounted` stayed true and
  // the global dim stuck at full opacity.
  describe('dismissal cleanup', () => {
    it('releases the backdrop claim and notifies onClose when gorhom fires only onDismiss (skipped onChange)', () => {
      const onClose = jest.fn();
      const { ref, onDismiss, animatedIndex } = openTray({ onClose });

      // Lockstep backdrop wired: the sheet's animatedIndex SV is handed to
      // gorhom so the dim ramps with the sheet's motion.
      expect(animatedIndex).toBe(mockBackdropAnimatedIndex);

      act(() => {
        onDismiss();
      });

      expect(ref.current!.isActive()).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
      // Backdrop slot released on the onDismiss close path.
      expect(mockBackdropOnChange).toHaveBeenCalledWith(-1);
    });

    it('notifies onClose exactly once when onChange(-1) and onDismiss both fire (normal close)', () => {
      const onClose = jest.fn();
      const { ref, onChange, onDismiss } = openTray({ onClose });

      act(() => {
        onChange(-1);
      });
      // Gorhom's unmount() still fires onDismiss after the settled-closed
      // onChange — the captured handler must dedupe.
      act(() => {
        onDismiss();
      });

      expect(ref.current!.isActive()).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
      // Backdrop slot released on the settled-closed onChange(-1) path.
      expect(mockBackdropOnChange).toHaveBeenCalledWith(-1);
    });

    it('re-arms the dedupe on reopen so the next close notifies again', () => {
      const onClose = jest.fn();
      const { ref, onDismiss } = openTray({ onClose });

      act(() => {
        onDismiss();
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      act(() => {
        ref.current!.open();
      });
      const reopened = screen.UNSAFE_getByProps({ detached: true });
      const reopenedOnChange = reopened.props.onChange as (
        index: number,
      ) => void;
      expect(ref.current!.isActive()).toBe(true);

      act(() => {
        reopenedOnChange(-1);
      });
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(ref.current!.isActive()).toBe(false);
    });
  });

  // The floating tab bar un-hides off `onClose`. Firing it at the start of the
  // close (gorhom's `onAnimate` toward -1) lets the bar animate back in
  // parallel with the slide-down instead of after the settled-closed signal.
  describe('early close notification', () => {
    it('notifies onClose at the start of the close animation (onAnimate → -1)', () => {
      const onClose = jest.fn();
      const { onAnimate } = openTray({ onClose });

      act(() => {
        onAnimate(0, -1);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not notify onClose again when the early close later settles', () => {
      const onClose = jest.fn();
      const { onAnimate, onChange } = openTray({ onClose });

      act(() => {
        onAnimate(0, -1);
      });
      act(() => {
        onChange(-1);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('re-fires onOpen when a started close reverses before settling', () => {
      const onOpen = jest.fn();
      const { onAnimate } = openTray({ onOpen });
      // open() fired onOpen once already.
      expect(onOpen).toHaveBeenCalledTimes(1);

      act(() => {
        onAnimate(0, -1);
      });
      act(() => {
        onAnimate(-1, 0);
      });

      expect(onOpen).toHaveBeenCalledTimes(2);
    });
  });
});
