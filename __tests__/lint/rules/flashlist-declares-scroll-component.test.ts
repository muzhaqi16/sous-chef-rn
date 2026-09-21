import { testRule } from '#/test-utils/eslintRuleTester';

testRule('flashlist-declares-scroll-component', {
  valid: [
    'const C = () => <FlashList data={rows} renderScrollComponent={SwipeAwareScrollComponent} />;',
    'const C = () => <FlashList data={rows} renderScrollComponent={BottomSheetScrollable} />;',
    // Not a recycling list.
    'const C = () => <ScrollView>{rows}</ScrollView>;',
  ],
  invalid: [
    {
      code: 'const C = () => <FlashList data={rows} renderItem={renderItem} />;',
      errors: ['undeclared'],
    },
    // Declared, but through RN's own ScrollView: the rows lose RNGH's gesture
    // exactly as if nothing were declared.
    {
      code: 'const C = () => <FlashList data={rows} renderScrollComponent={ScrollView} />;',
      errors: ['wrongHost'],
    },
    {
      code: 'const C = () => <FlashList data={rows} renderScrollComponent={props => <ScrollView {...props} />} />;',
      errors: ['wrongHost'],
    },
  ],
});
