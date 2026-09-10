import { readFileSync } from 'fs';
import { sync as glob } from 'glob';

/**
 * A text input inside a bottom sheet must resolve to gorhom's
 * `BottomSheetTextInput`, or the sheet is blind to the keyboard and it covers
 * the field being typed into. The shared inputs pick it from
 * `BottomSheetInputContext`, which only the form/list scrollables provide — so
 * a sheet that supplies neither, and passes no explicit `useBottomSheetInput`,
 * renders a plain RN input and the user types where they cannot see.
 */
const SHARED_INPUT =
  /<(FormInput|FormTextArea|FractionInput|EditableCounter|BaseInput|BottomSheetAutocompleteInput)\b/;

/** Either scrollable provides the context, as does the explicit escape hatch. */
const SUPPLIES_CONTEXT =
  /BottomSheetFormScrollView|BottomSheetInputProvider|mode="form"|mode="list"|useBottomSheetInput/;

const IS_SHEET = /BottomSheetModal|<Sheet\b/;

const sources = glob('src/**/*.tsx', { ignore: ['**/__tests__/**'] });

describe('every input inside a sheet is bound to the keyboard', () => {
  it('finds the sheets it is meant to be checking', () => {
    const sheets = sources.filter(f => {
      const src = readFileSync(f, 'utf8');
      return IS_SHEET.test(src) && SHARED_INPUT.test(src);
    });
    expect(sheets.length).toBeGreaterThan(5);
  });

  it('leaves no sheet input resolving to a plain RN TextInput', () => {
    const bare = sources
      .filter(f => {
        const src = readFileSync(f, 'utf8');
        return (
          IS_SHEET.test(src) &&
          SHARED_INPUT.test(src) &&
          !SUPPLIES_CONTEXT.test(src)
        );
      })
      .sort();

    expect(bare).toEqual([]);
  });
});
