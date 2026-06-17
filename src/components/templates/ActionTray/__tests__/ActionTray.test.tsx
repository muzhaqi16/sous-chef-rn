'use no memo';
import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import {
  NavigationContext,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { Text } from '#components/atoms/Text';
import { useBackdropClaim } from '#components/providers/OverlayBackdropProvider';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { ActionTray } from '../ActionTray';
import type { ActionTrayRef } from '../types';

// The backdrop is claimed declaratively: `useBackdropClaim(mounted &&
// enableBackdrop, { opacity })` ties the slot's lifecycle to React state, so
// it's released on close/unmount regardless of gorhom's event ordering. The
// `opacity` is an animatedIndex-driven SharedValue (lockstep dim). Mocking the
// hook lets tests assert the active flag toggling with open/close.
jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useBackdropClaim: jest.fn(),
}));

jest.mock('#hooks/useBottomSheetBackHandler', () => ({
  useBottomSheetBackHandler: jest.fn(),
}));

describe('ActionTray', () => {
  beforeEach(() => {
    (useBackdropClaim as jest.Mock).mockClear();
    (useBottomSheetBackHandler as jest.Mock).mockClear();
  });

  // Render an opened tray and capture gorhom's prop handlers. The mock renders
  // BottomSheetModal as a View carrying all props; `detached` uniquely
  // identifies it. Capture the handlers up front — gorhom holds the functions,
  // and the element unmounts as soon as the first close signal lands.
  const openTray = (handlers?: { onClose?: () => void }) => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref} onClose={handlers?.onClose}>
        <Text>Content</Text>
      </ActionTray>,
    );
    act(() => {
      ref.current!.open();
    });
    const modal = screen.UNSAFE_getByProps({ detached: true });
    const { onChange, onDismiss, animatedIndex } = modal.props as {
      onChange: (index: number) => void;
      onDismiss: () => void;
      animatedIndex: { value: number };
    };
    return { ref, onChange, onDismiss, animatedIndex };
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

  it('enables the Android back handler only while the tray is open', () => {
    const ref = React.createRef<ActionTrayRef>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    // Closed: back handler disabled so hardware back navigates normally.
    expect(useBottomSheetBackHandler).toHaveBeenLastCalledWith(
      expect.anything(),
      false,
    );

    act(() => {
      ref.current!.open();
    });
    // Open: back handler enabled so hardware back dismisses the tray.
    expect(useBottomSheetBackHandler).toHaveBeenLastCalledWith(
      expect.anything(),
      true,
    );
  });

  it('tears down on screen blur while open (dismiss-on-blur)', () => {
    // ActionTray reads useContext(NavigationContext) + addListener('blur'), so
    // provide a mock navigation via context. The component only uses
    // `addListener`, so the mock implements exactly that subset.
    type Listener = () => void;
    type MockNavigation = Pick<NavigationProp<ParamListBase>, 'addListener'>;
    const listeners: Record<string, Listener[]> = {};
    const navigation: MockNavigation = {
      addListener: jest.fn((event: string, cb: Listener) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
        return () => {
          listeners[event] = listeners[event].filter(l => l !== cb);
        };
      }),
    } as MockNavigation;
    const emit = (event: string) => listeners[event]?.forEach(cb => cb());

    const onClose = jest.fn();
    const ref = React.createRef<ActionTrayRef>();
    render(
      <NavigationContext.Provider
        value={navigation as NavigationProp<ParamListBase>}
      >
        <ActionTray ref={ref} onClose={onClose}>
          <Text>Content</Text>
        </ActionTray>
      </NavigationContext.Provider>,
    );

    act(() => {
      ref.current!.open();
    });
    expect(ref.current!.isActive()).toBe(true);

    // Navigating away (e.g. programmatic nav) fires 'blur' → tray tears down.
    act(() => {
      emit('blur');
    });
    expect(ref.current!.isActive()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
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

      // Lockstep backdrop wired: the sheet's animatedIndex SV drives the dim.
      expect(animatedIndex).toBeDefined();
      // Slot claimed (active) while open.
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ opacity: expect.anything() }),
      );

      act(() => {
        onDismiss();
      });

      expect(ref.current!.isActive()).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
      // Slot released (active false) — tied to React state, not gorhom events.
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: expect.anything() }),
      );
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
      // Slot released (active false) once cleanup runs.
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: expect.anything() }),
      );
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
});
