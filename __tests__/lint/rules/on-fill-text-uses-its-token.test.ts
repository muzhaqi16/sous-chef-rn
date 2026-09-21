import { testRule } from '#/test-utils/eslintRuleTester';

const sheet = (body: string) =>
  `const styles = StyleSheet.create(theme => (${body}));`;

testRule('on-fill-text-uses-its-token', {
  valid: [
    sheet(
      '{ chip: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary } }',
    ),
    sheet(
      '{ chip: { backgroundColor: theme.colors.error, color: theme.colors.onError } }',
    ),
    // No fill anywhere in the file: a white foreground is over something else.
    sheet("{ label: { color: '#fff' } }"),
    // A ground the theme does not paint.
    sheet(
      '{ hero: { backgroundColor: theme.colors.primary }, caption: { color: theme.colors.onScrim } }',
    ),
  ],
  invalid: [
    {
      code: sheet(
        "{ chip: { backgroundColor: theme.colors.primary }, chipText: { color: '#fff' } }",
      ),
      errors: ['hardcodedWhite'],
    },
    {
      code: sheet(
        "{ chip: { backgroundColor: theme.colors.danger }, chipText: { color: 'white' } }",
      ),
      errors: ['hardcodedWhite'],
    },
    {
      // A token, not a literal — so it reads as correct and inverts.
      code: sheet(
        '{ chip: { backgroundColor: theme.colors.danger, color: theme.colors.onPrimary } }',
      ),
      errors: ['onTokenNotNamingItsFill'],
    },
  ],
});
