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
  ],
});
