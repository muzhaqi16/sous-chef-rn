'use no memo';
import React, { useState } from 'react';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { InlineAutocomplete } from '../InlineAutocomplete';

interface Row {
  id: string;
  unitName?: string;
}

/**
 * Mirrors the entry-list shape (`NetWeightEntryList` / `UnitEntryList`): the
 * `onChangeText` handed to the autocomplete closes over the CURRENT rows
 * array, and a sibling control can replace that array while a keystroke is
 * still sitting in the debounce window.
 */
const EntryListHarness: React.FC<{ onRows: (rows: Row[]) => void }> = ({
  onRows,
}) => {
  const [rows, setRows] = useState<Row[]>([{ id: 'r1' }]);

  const commit = (next: Row[]) => {
    setRows(next);
    onRows(next);
  };

  return (
    <>
      <InlineAutocomplete<string>
        label="Unit"
        value={rows[0].unitName ?? ''}
        onChangeText={text =>
          commit(rows.map((r, i) => (i === 0 ? { ...r, unitName: text } : r)))
        }
        items={[]}
        renderItem={item => <Text>{item}</Text>}
        keyExtractor={item => item}
        onSelect={() => {}}
        testID="unit-input"
      />
      <Pressable
        testID="add-row"
        onPress={() => commit([...rows, { id: 'r2' }])}
      >
        <Text>Add Row</Text>
      </Pressable>
    </>
  );
};

describe('InlineAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not revert a concurrent state change made during the debounce window', () => {
    const onRows = jest.fn();
    render(<EntryListHarness onRows={onRows} />);

    // Keystroke starts the 250ms debounce toward the parent.
    fireEvent.changeText(screen.getByTestId('unit-input'), 'oz');

    // Before it fires, a sibling control replaces the rows array. The pending
    // timer still closes over the pre-add array.
    act(() => {
      fireEvent.press(screen.getByTestId('add-row'));
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const finalRows = onRows.mock.calls.at(-1)?.[0] as Row[];
    // The added row must survive, and the typed text must still land.
    expect(finalRows).toHaveLength(2);
    expect(finalRows[0].unitName).toBe('oz');
  });

  it('forwards typed text to the parent after the debounce elapses', () => {
    const onRows = jest.fn();
    render(<EntryListHarness onRows={onRows} />);

    fireEvent.changeText(screen.getByTestId('unit-input'), 'kg');
    expect(onRows).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onRows).toHaveBeenCalledTimes(1);
    expect((onRows.mock.calls[0][0] as Row[])[0].unitName).toBe('kg');
  });
});
