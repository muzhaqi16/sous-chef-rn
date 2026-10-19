import React from 'react';
import { Keyboard } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { BottomSheetModal } from '../useStandardBottomSheet';

type OnAnimate = (
  fromIndex: number,
  toIndex: number,
  fromPosition: number,
  toPosition: number,
) => void;

const renderSheet = (onAnimate?: OnAnimate) => {
  render(
    <BottomSheetModal name="sheet" onAnimate={onAnimate}>
      <Text>content</Text>
    </BottomSheetModal>,
  );
  // The deepest match is the mock's host, which gorhom's wrapper props reach.
  const matches = screen.UNSAFE_getAllByProps({ name: 'sheet' });
  return (matches[matches.length - 1]!.props as { onAnimate: OnAnimate })
    .onAnimate;
};

describe('BottomSheetModal', () => {
  const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');

  beforeEach(() => dismissKeyboard.mockClear());

  // A focused input unmounted with the sheet would hand its focus to the
  // first field on the screen beneath.
  it('blurs the focused input as a close starts', () => {
    const onAnimate = jest.fn();
    renderSheet(onAnimate)(0, -1, 300, 800);

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(onAnimate).toHaveBeenCalledWith(0, -1, 300, 800);
  });

  it('leaves the keyboard alone while opening or moving between snaps', () => {
    const animate = renderSheet();
    animate(-1, 0, 800, 300);
    animate(0, 1, 300, 100);

    expect(dismissKeyboard).not.toHaveBeenCalled();
  });
});
