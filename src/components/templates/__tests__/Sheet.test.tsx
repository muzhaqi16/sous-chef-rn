import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { alertService } from '#services/alertService';
import { t } from '#i18n';
import { lightTheme } from '#theme/themes';
import { Sheet } from '../Sheet';
import { SheetHeader } from '../SheetHeader';
import { useSheetUnsavedInput } from '../SheetCloseGuard';

/** A draft held inside the sheet's content, as a sheet's form holds its fields. */
const Draft = () => {
  const [taps, setTaps] = useState(0);
  return (
    <Pressable accessibilityLabel="add one" onPress={() => setTaps(taps + 1)}>
      <Text>{`taps ${taps}`}</Text>
    </Pressable>
  );
};

/** What the sheet's parent holds lives on through a closing. */
const Parent = ({ visible }: { visible: boolean }) => {
  const [kept, setKept] = useState(0);
  return (
    <Sheet visible={visible} onDismiss={() => undefined} snapPoints={['50%']}>
      <Pressable
        accessibilityLabel="keep one"
        onPress={() => setKept(kept + 1)}
      >
        <Text>{`kept ${kept}`}</Text>
      </Pressable>
      <Draft />
    </Sheet>
  );
};

describe('Sheet', () => {
  // The modal unmounts its content once dismissed (gorhom 5.2.14), so a
  // sheet's own form state needs no reset of its own.
  it('opens fresh: what its content held goes with the closing', () => {
    const { rerender } = render(<Parent visible />);
    fireEvent.press(screen.getByLabelText('add one'));
    expect(screen.getByText('taps 1')).toBeTruthy();

    rerender(<Parent visible={false} />);
    rerender(<Parent visible />);

    expect(screen.getByText('taps 0')).toBeTruthy();
  });

  it('keeps what its parent holds, for a sheet that keeps unsent input', () => {
    const { rerender } = render(<Parent visible />);
    fireEvent.press(screen.getByLabelText('keep one'));

    rerender(<Parent visible={false} />);
    rerender(<Parent visible />);

    expect(screen.getByText('kept 1')).toBeTruthy();
  });

  // A list's rows inset themselves, so the title has to take the gutter itself.
  it.each([
    ['a list', { mode: 'list' as const }],
    ['a view with no gutter', { gutter: 'none' as const }],
  ])('sets the title on the page gutter in %s', (_name, shape) => {
    render(
      <Sheet
        visible
        onDismiss={() => undefined}
        snapPoints={['50%']}
        title="Pick some"
        {...shape}
      >
        <Draft />
      </Sheet>,
    );

    // The title's row: the nearest host view above it.
    let row = screen.getByText('Pick some').parent;
    while (row && typeof row.type !== 'string') row = row.parent;
    expect(row).toHaveStyle({
      paddingHorizontal: lightTheme.layout.pageGutter,
    });
  });

  // A sheet stacked over its host pushes, where gorhom's `switch` minimizes it.
  it('lets a modal option replace the standard value', () => {
    render(
      <Sheet
        visible
        onDismiss={() => undefined}
        snapPoints={['50%']}
        modalOptions={{ stackBehavior: 'push' }}
      >
        <Draft />
      </Sheet>,
    );

    expect(screen.UNSAFE_getByProps({ stackBehavior: 'push' })).toBeTruthy();
  });

  describe('with input its content holds', () => {
    const HeldInput = ({ unsaved }: { unsaved: boolean }) => {
      useSheetUnsavedInput(unsaved);
      return <Text>form</Text>;
    };
    const FormSheet = ({
      visible = true,
      unsaved,
      onDismiss,
    }: {
      visible?: boolean;
      unsaved: boolean;
      onDismiss: () => void;
    }) => (
      <Sheet
        visible={visible}
        onDismiss={onDismiss}
        snapPoints={['50%']}
        header={<SheetHeader title="Edit" onClose={onDismiss} />}
      >
        <HeldInput unsaved={unsaved} />
      </Sheet>
    );
    // gorhom's own drag close, as it reports the close starting.
    const onAnimate = () =>
      screen.UNSAFE_root.findAll(
        node => typeof node.props.onAnimate === 'function',
      )[0]?.props.onAnimate as (from: number, to: number) => void;
    // Discard, then the dismissal gorhom finishes after its close animation.
    const discard = async (alert: jest.SpyInstance) => {
      const [, , buttons] = alert.mock.calls[0] ?? [];
      await act(async () => {
        buttons?.[1]?.onPress?.();
        await Promise.resolve();
      });
    };

    let alert: jest.SpyInstance;
    beforeEach(() => {
      alert = jest.spyOn(alertService, 'alert').mockImplementation(() => {});
      // A global mock already: the spy is that mock, its calls kept across tests.
      alert.mockClear();
    });
    afterEach(() => jest.restoreAllMocks());

    it('asks before its close drops it, and closes on Discard', async () => {
      const onDismiss = jest.fn();
      render(<FormSheet unsaved onDismiss={onDismiss} />);

      fireEvent.press(screen.getByTestId('header-close-button'));

      expect(alert).toHaveBeenCalledWith(
        t('confirmations.discardChangesTitle'),
        t('confirmations.discardChanges'),
        expect.any(Array),
      );
      expect(onDismiss).not.toHaveBeenCalled();
      await discard(alert);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('closes at once when nothing is typed', () => {
      const onDismiss = jest.fn();
      render(<FormSheet unsaved={false} onDismiss={onDismiss} />);

      fireEvent.press(screen.getByTestId('header-close-button'));

      expect(alert).not.toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('asks before a drag drops it, and closes on Discard', async () => {
      const onDismiss = jest.fn();
      render(<FormSheet unsaved onDismiss={onDismiss} />);

      act(() => onAnimate()(0, -1));

      expect(alert).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
      await discard(alert);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('never asks for a close its owner makes, as after a save', () => {
      const onDismiss = jest.fn();
      const { rerender } = render(<FormSheet unsaved onDismiss={onDismiss} />);
      const closing = onAnimate();

      rerender(<FormSheet visible={false} unsaved onDismiss={onDismiss} />);
      act(() => closing(0, -1));

      expect(alert).not.toHaveBeenCalled();
    });
  });
});
