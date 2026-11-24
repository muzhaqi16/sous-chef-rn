import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Sheet } from '../Sheet';

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

  // A form holding input turns pan-down off; the standard `true` must not win.
  it('lets a modal option replace the standard value', () => {
    render(
      <Sheet
        visible
        onDismiss={() => undefined}
        snapPoints={['50%']}
        modalOptions={{ enablePanDownToClose: false }}
      >
        <Draft />
      </Sheet>,
    );

    expect(
      screen.UNSAFE_getByProps({ enablePanDownToClose: false }),
    ).toBeTruthy();
  });
});
