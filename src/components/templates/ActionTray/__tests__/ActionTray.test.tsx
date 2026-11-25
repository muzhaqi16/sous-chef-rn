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
import { useBottomSheetBackHandler } from '#hooks/ui/useBottomSheetBackHandler';
import { ActionTray } from '../ActionTray';
import type { ActionTrayProps } from '../types';

// The backdrop is claimed declaratively: `useBackdropClaim(mounted &&
// enableBackdrop, { opacity })` ties the slot's lifecycle to React state, so
// it's released on close/unmount regardless of gorhom's event ordering. The
// `opacity` is an animatedIndex-driven SharedValue (lockstep dim). Mocking the
// hook lets tests assert the active flag toggling with open/close.
jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useBackdropClaim: jest.fn(),
}));

jest.mock('#hooks/ui/useBottomSheetBackHandler', () => ({
  useBottomSheetBackHandler: jest.fn(),
}));

describe('ActionTray', () => {
  beforeEach(() => {
    (useBackdropClaim as jest.Mock).mockClear();
    (useBottomSheetBackHandler as jest.Mock).mockClear();
  });

  const tray = (
    visible: boolean,
    props: Partial<Omit<ActionTrayProps, 'visible'>> = {},
  ) => (
    <ActionTray visible={visible} onDismiss={jest.fn()} {...props}>
      <Text>Content</Text>
    </ActionTray>
  );
  const shown = () => screen.queryByText('Content') !== null;

  // Render an opened tray and capture gorhom's prop handlers. The mock renders
  // BottomSheetModal as a View carrying all props; `detached` uniquely
  // identifies it. Capture the handlers up front — gorhom holds the functions,
  // and the element unmounts as soon as the first close signal lands.
  const openTray = (onDismiss: () => void = jest.fn()) => {
    const view = render(tray(false, { onDismiss }));
    view.rerender(tray(true, { onDismiss }));
    const modal = screen.UNSAFE_getByProps({ detached: true });
    const handlers = modal.props as {
      onChange: (index: number) => void;
      onDismiss: () => void;
      animatedIndex: { value: number };
    };
    return { view, ...handlers };
  };

  it('renders nothing when not opened', () => {
    const { toJSON } = render(tray(false));
    expect(toJSON()).toBeNull();
  });

  it('renders its content and title once visible', () => {
    const view = render(tray(false, { title: 'Actions' }));
    view.rerender(tray(true, { title: 'Actions' }));
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('enables the Android back handler only while the tray is open', () => {
    const view = render(tray(false));
    // Closed: back handler disabled so hardware back navigates normally.
    expect(useBottomSheetBackHandler).toHaveBeenLastCalledWith(
      expect.anything(),
      false,
    );

    view.rerender(tray(true));
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
          listeners[event] = listeners[event]!.filter(l => l !== cb);
        };
      }),
    } as MockNavigation;
    const emit = (event: string) => listeners[event]?.forEach(cb => cb());

    const onDismiss = jest.fn();
    const inNavigation = (visible: boolean) => (
      <NavigationContext.Provider
        value={navigation as NavigationProp<ParamListBase>}
      >
        {tray(visible, { onDismiss })}
      </NavigationContext.Provider>
    );
    const view = render(inNavigation(false));
    view.rerender(inNavigation(true));
    expect(shown()).toBe(true);

    // Navigating away (e.g. programmatic nav) fires 'blur' → tray tears down.
    act(() => {
      emit('blur');
    });
    expect(shown()).toBe(false);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Gorhom skips onChange(-1) entirely when a close interrupts an open
  // animation that never settled (its internal animatedCurrentIndex is still
  // -1, so the settled-closed index "didn't change"); in that path only
  // onDismiss fires, from the modal's unmount(). Keying cleanup off
  // onChange(-1) alone leaked the backdrop claim — `mounted` stayed true and
  // the global dim stuck at full opacity.
  describe('dismissal cleanup', () => {
    it('releases the backdrop claim and tells its owner when gorhom fires only onDismiss (skipped onChange)', () => {
      const owner = jest.fn();
      const { onDismiss, animatedIndex } = openTray(owner);

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

      expect(shown()).toBe(false);
      expect(owner).toHaveBeenCalledTimes(1);
      // Slot released (active false) — tied to React state, not gorhom events.
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: expect.anything() }),
      );
    });

    it('tells its owner exactly once when onChange(-1) and onDismiss both fire (normal close)', () => {
      const owner = jest.fn();
      const { onChange, onDismiss } = openTray(owner);

      act(() => {
        onChange(-1);
      });
      // Gorhom's unmount() still fires onDismiss after the settled-closed
      // onChange — the captured handler must dedupe.
      act(() => {
        onDismiss();
      });

      expect(shown()).toBe(false);
      expect(owner).toHaveBeenCalledTimes(1);
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: expect.anything() }),
      );
    });

    it('re-arms the dedupe on reopen so the next close tells its owner again', () => {
      const owner = jest.fn();
      const { view, onDismiss } = openTray(owner);

      act(() => {
        onDismiss();
      });
      expect(owner).toHaveBeenCalledTimes(1);

      view.rerender(tray(false, { onDismiss: owner }));
      view.rerender(tray(true, { onDismiss: owner }));
      const reopened = screen.UNSAFE_getByProps({ detached: true });
      const reopenedOnChange = reopened.props.onChange as (
        index: number,
      ) => void;
      expect(shown()).toBe(true);

      act(() => {
        reopenedOnChange(-1);
      });
      expect(owner).toHaveBeenCalledTimes(2);
      expect(shown()).toBe(false);
    });
  });
});
