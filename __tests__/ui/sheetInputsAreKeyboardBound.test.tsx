import React from 'react';
import { TextInput } from 'react-native';
import { cleanup, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { Sheet } from '#components/templates/Sheet';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { FractionInput } from '#components/molecules/FractionInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { BottomSheetAutocompleteInput } from '#features/catalog/components/BottomSheetAutocompleteInput';

/**
 * A text input inside a bottom sheet must be gorhom's `BottomSheetTextInput`,
 * or the sheet is blind to the keyboard and it covers the field being typed
 * into. `ThemedTextInput` asks gorhom where it renders and picks it in every
 * sheet mode (`themedTextInputs.test.tsx`); this holds every shared input to
 * rendering through it.
 */

const noop = () => {};

const SHARED_INPUTS: Array<[string, React.ReactElement]> = [
  ['FormInput', <FormInput label="Name" value="" onChangeText={noop} />],
  ['FormTextArea', <FormTextArea label="Notes" value="" onChangeText={noop} />],
  ['FractionInput', <FractionInput value="" onChangeText={noop} />],
  [
    'EditableCounter',
    <EditableCounter label="Servings" value="1" onChangeText={noop} />,
  ],
  ['BaseInput', <BaseInput value="" onChangeText={noop} />],
  [
    'BottomSheetAutocompleteInput',
    <BottomSheetAutocompleteInput<string>
      value=""
      onChangeText={noop}
      title="Store"
      searchPlaceholder="Search"
      emptyText="None"
      data={[]}
      renderItem={() => <></>}
      keyExtractor={item => item}
      onSelectItem={noop}
    />,
  ],
];

// The suite's gorhom mock names its input, which nothing else imports.
const { BottomSheetTextInput } = jest.requireMock<{
  BottomSheetTextInput: React.ComponentType;
}>('@gorhom/bottom-sheet');

/** Whether `input`, rendered in a sheet, reaches gorhom's text input. */
function reachesSheetInput(input: React.ReactElement): boolean {
  renderWithApollo(
    <Sheet mode="view" visible onDismiss={noop} snapPoints={['50%']}>
      {input}
    </Sheet>,
  );
  const found = screen.UNSAFE_queryAllByType(BottomSheetTextInput).length > 0;
  cleanup();
  return found;
}

describe('every input inside a sheet is bound to the keyboard', () => {
  it("catches an input that renders React Native's own", () => {
    expect(reachesSheetInput(<TextInput testID="bare" />)).toBe(false);
  });

  it.each(SHARED_INPUTS)('%s reaches gorhom’s input in a sheet', (_, input) => {
    expect(reachesSheetInput(input)).toBe(true);
  });
});
