'use no memo';
import React, { useState } from 'react';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { InlineAutocomplete } from '#features/catalog/components/InlineAutocomplete';
import { t } from '#/i18n';
import { useStore } from '#store';

interface Row {
  id: string;
  unitName?: string;
}

/**
 * Mirrors the entry-list shape (`NetWeightEntryList` / `UnitEntryList`): the
 * `onChangeText` handed to the autocomplete closes over the CURRENT rows
 * array, and a sibling control can replace that array right after a keystroke.
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
        value={rows[0]!.unitName ?? ''}
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

  it('keeps a row a sibling control adds right after a keystroke', () => {
    const onRows = jest.fn();
    render(<EntryListHarness onRows={onRows} />);

    fireEvent.changeText(screen.getByTestId('unit-input'), 'oz');
    fireEvent.press(screen.getByTestId('add-row'));

    const finalRows = onRows.mock.calls.at(-1)?.[0] as Row[];
    // The added row must survive, and the typed text must still land.
    expect(finalRows).toHaveLength(2);
    expect(finalRows[0]!.unitName).toBe('oz');
  });

  // A form saved straight after typing must hold what was typed.
  it('forwards typed text to the parent at once', () => {
    const onRows = jest.fn();
    render(<EntryListHarness onRows={onRows} />);

    fireEvent.changeText(screen.getByTestId('unit-input'), 'kg');

    expect(onRows).toHaveBeenCalledTimes(1);
    expect((onRows.mock.calls[0][0] as Row[])[0]!.unitName).toBe('kg');
  });

  // `reserveDropdownSpace` renders an in-flow spacer so a sheet sized to its own
  // content grows to fit the absolutely-positioned list. The spacer must be tied
  // to the list ACTUALLY rendering, not to the broader "should the dropdown
  // show" flag — that stays true for a settled search that matched nothing, and
  // reserving then leaves a band of blank sheet under the field.
  // A host that saves on finishing the field (a store cleared once emptied)
  // hears it from either variant.
  it('says when the field is finished', () => {
    const onEndEditing = jest.fn();
    render(
      <InlineAutocomplete<string>
        value=""
        onChangeText={() => {}}
        items={[]}
        renderItem={item => <Text>{item}</Text>}
        keyExtractor={item => item}
        onSelect={() => {}}
        onEndEditing={onEndEditing}
        testID="unit-input"
      />,
    );

    fireEvent(screen.getByTestId('unit-input'), 'endEditing');

    expect(onEndEditing).toHaveBeenCalledTimes(1);
  });

  describe('reserveDropdownSpace', () => {
    const Field: React.FC<{ items: string[]; loading?: boolean }> = ({
      items,
      loading,
    }) => (
      <InlineAutocomplete<string>
        label="Unit"
        value="kg"
        onChangeText={() => {}}
        items={items}
        loading={loading}
        renderItem={item => <Text>{item}</Text>}
        keyExtractor={item => item}
        onSelect={() => {}}
        reserveDropdownSpace
        testID="unit-input"
      />
    );

    // Typing is what opens the dropdown — focus only opens it when there are
    // already suggestions to show, so it cannot reach the empty-result state
    // this is about.
    const search = (term: string) => {
      fireEvent.changeText(screen.getByTestId('unit-input'), term);
      act(() => {
        jest.advanceTimersByTime(300);
      });
    };

    it('reserves space while suggestions are on screen', () => {
      render(<Field items={['kg', 'kilogram']} />);
      search('k');

      expect(screen.getByTestId('dropdown-spacer')).toBeTruthy();
    });

    // The reserve is what a dynamically-sized sheet takes its height from, so
    // releasing it between keystrokes steps the whole sheet down and back up.
    it('holds the reserve while the next search is in flight', () => {
      const { rerender } = render(<Field items={['kg', 'kilogram']} />);
      search('k');
      expect(screen.getByTestId('dropdown-spacer')).toBeTruthy();

      // The list is momentarily empty while the query for the new term runs.
      rerender(<Field items={[]} loading />);

      expect(screen.getByTestId('dropdown-spacer')).toBeTruthy();
    });

    it('reserves nothing when a settled search matched no suggestions', () => {
      render(<Field items={[]} />);
      // A search that has come back empty: the dropdown is "showing" by the
      // flag, but there is no list and no footer, so nothing renders.
      search('zzz');

      expect(screen.queryByText('kg')).toBeNull();
      expect(screen.queryByTestId('dropdown-spacer')).toBeNull();
    });
  });
});

describe('InlineAutocomplete offline', () => {
  const Picker: React.FC<{ holdsEverything?: boolean; items?: string[] }> = ({
    holdsEverything,
    items = [],
  }) => {
    const [value, setValue] = useState('');
    return (
      <InlineAutocomplete<string>
        value={value}
        onChangeText={setValue}
        items={items}
        renderItem={item => <Text>{item}</Text>}
        keyExtractor={item => item}
        onSelect={() => {}}
        holdsEverything={holdsEverything}
        testID="picker"
      />
    );
  };

  const typeAndSettle = (text: string) => {
    fireEvent.changeText(screen.getByTestId('picker'), text);
    act(() => {
      jest.runOnlyPendingTimers();
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    useStore.setState({ isOnline: false, apiReachable: null });
  });

  afterEach(() => {
    jest.useRealTimers();
    useStore.setState({ isOnline: true, apiReachable: null });
  });

  it('says a wider search needs a connection when nothing held matches', () => {
    render(<Picker />);
    typeAndSettle('kale');

    expect(
      screen.getByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeTruthy();
  });

  it('lists what matches, with no note', () => {
    render(<Picker items={['Kale']} />);
    typeAndSettle('kale');

    expect(screen.getByText('Kale')).toBeTruthy();
    expect(
      screen.queryByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeNull();
  });

  it('stays closed for a set the device holds whole', () => {
    render(<Picker holdsEverything />);
    typeAndSettle('kale');

    expect(
      screen.queryByText(t('empty.noHeldMatchFor', { query: 'kale' })),
    ).toBeNull();
  });
});
