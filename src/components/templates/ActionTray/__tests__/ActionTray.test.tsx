'use no memo';
import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { useBackdropClaim } from '#components/providers/OverlayBackdropProvider';
import { ActionTray } from '../ActionTray';
import type { ActionTrayContentProps, ActionTrayRef } from '../types';

jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useBackdropClaim: jest.fn(),
}));

jest.mock('../ActionTrayContent', () => ({
  ActionTrayContent: ({ children, title }: ActionTrayContentProps) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      { testID: 'action-tray-content' },
      title ? R.createElement(RN.Text, null, title) : null,
      children,
    );
  },
}));

describe('ActionTray', () => {
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
    const openTray = (onClose?: () => void) => {
      const ref = React.createRef<ActionTrayRef>();
      render(
        <ActionTray ref={ref} onClose={onClose}>
          <Text>Content</Text>
        </ActionTray>,
      );
      act(() => {
        ref.current!.open();
      });
      // The gorhom mock renders BottomSheetModal as a View carrying all
      // props; `detached` uniquely identifies it in this tree. Capture the
      // handler references up front — gorhom holds the functions, and the
      // element unmounts as soon as the first close signal lands.
      const modal = screen.UNSAFE_getByProps({ detached: true });
      const { onChange, onDismiss } = modal.props as {
        onChange: (index: number) => void;
        onDismiss: () => void;
      };
      return { ref, onChange, onDismiss };
    };

    it('releases the backdrop claim and notifies onClose when gorhom fires only onDismiss (skipped onChange)', () => {
      const onClose = jest.fn();
      const { ref, onDismiss } = openTray(onClose);

      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ opacity: 0.5 }),
      );

      act(() => {
        onDismiss();
      });

      expect(ref.current!.isActive()).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: 0.5 }),
      );
    });

    it('notifies onClose exactly once when onChange(-1) and onDismiss both fire (normal close)', () => {
      const onClose = jest.fn();
      const { ref, onChange, onDismiss } = openTray(onClose);

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
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ opacity: 0.5 }),
      );
    });

    it('re-arms the dedupe on reopen so the next close notifies again', () => {
      const onClose = jest.fn();
      const { ref, onDismiss } = openTray(onClose);

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
      expect(useBackdropClaim).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ opacity: 0.5 }),
      );

      act(() => {
        reopenedOnChange(-1);
      });
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(ref.current!.isActive()).toBe(false);
    });
  });
});
