import React, { useState } from 'react';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  SheetHeaderOutlet,
  SheetHeaderSlot,
  SheetHeaderStoreProvider,
  useSheetHeaderStore,
} from '../SheetHeaderSlot';

const saved: number[] = [];

/** A form that owns its bar's handler, as a keyed sheet form does. */
const CountingForm = () => {
  const [count, setCount] = useState(0);
  return (
    <>
      <SheetHeaderSlot>
        <Pressable accessibilityLabel="save" onPress={() => saved.push(count)}>
          <Text>save</Text>
        </Pressable>
      </SheetHeaderSlot>
      <Pressable accessibilityLabel="more" onPress={() => setCount(c => c + 1)}>
        <Text>more</Text>
      </Pressable>
    </>
  );
};

const SheetLike = ({ showForm }: { showForm: boolean }) => {
  const store = useSheetHeaderStore();
  return (
    <SheetHeaderStoreProvider value={store}>
      <SheetHeaderOutlet store={store} />
      {showForm ? <CountingForm /> : null}
    </SheetHeaderStoreProvider>
  );
};

beforeEach(() => {
  saved.length = 0;
});

it("shows the content's bar in the outlet, calling its latest handler", () => {
  render(<SheetLike showForm />);

  fireEvent.press(screen.getByLabelText('more'));
  fireEvent.press(screen.getByLabelText('more'));
  fireEvent.press(screen.getByLabelText('save'));

  expect(saved).toEqual([2]);
});

it('clears the bar when the content goes', () => {
  const view = render(<SheetLike showForm />);
  expect(screen.getByLabelText('save')).toBeTruthy();

  view.rerender(<SheetLike showForm={false} />);

  expect(screen.queryByLabelText('save')).toBeNull();
});

it('throws outside a sheet that takes its header from content', () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(() => render(<CountingForm />)).toThrow(
    'SheetHeaderStore is missing its provider',
  );
  jest.restoreAllMocks();
});
