import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-scrollable-in-bottom-sheet-view', {
  valid: [
    // The flex View is the fix: it bounds the height BottomSheetView cannot.
    'const C = () => (<BottomSheetView><View style={{ flex: 1 }}><Text>x</Text></View></BottomSheetView>);',
    'const C = () => (<BottomSheetView><Text>x</Text></BottomSheetView>);',
    // A scrollable outside the sheet view is not nested in it.
    'const C = () => (<><BottomSheetView><Text>x</Text></BottomSheetView><FlashList data={rows} /></>);',
  ],
  invalid: [
    {
      code: 'const C = () => (<BottomSheetView><FlashList data={rows} /></BottomSheetView>);',
      errors: ['nested'],
    },
    {
      // Nested deeper, and reached through a conditional.
      code: 'const C = () => (<BottomSheetView><View>{ready ? <BottomSheetScrollView /> : null}</View></BottomSheetView>);',
      errors: ['nested'],
    },
  ],
});
