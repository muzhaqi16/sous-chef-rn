import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-raw-color', {
  valid: [
    'const a = { backgroundColor: theme.colors.overlays.dark };',
    'const b = <Icon name="close" tone="onScrim" />;',
    // A colour word that is not a style value.
    "const c = t('labels.white');",
    "const d = { label: 'black' };",
  ],
  invalid: [
    { code: "const a = { backgroundColor: '#FFF' };", errors: ['rawColor'] },
    {
      code: "const b = { color: 'rgba(0, 0, 0, 0.6)' };",
      errors: ['rawColor'],
    },
    {
      code: 'const c = <Icon name="close" color="#fff" />;',
      errors: ['rawColor'],
    },
    {
      code: 'const d = <Icon name="check" color="white" />;',
      errors: ['rawColor'],
    },
    { code: "const e = { backgroundColor: 'black' };", errors: ['rawColor'] },
    {
      code: "const Mask = ({ edgeColor = '#62B1F6' }) => null;",
      errors: ['rawColor'],
    },
  ],
});
