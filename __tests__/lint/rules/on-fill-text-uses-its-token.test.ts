import { testRule } from '#/test-utils/eslintRuleTester';

const sheet = (body: string) =>
  `const styles = StyleSheet.create(theme => (${body}));`;

/** Two styles animated by one driver, as `Chip`'s container and label are. */
const animated = (fill: string, foreground: string) =>
  [
    'const box = useAnimatedStyle(() => {',
    '  const theme = animatedTheme.get();',
    `  return { backgroundColor: interpolateColor(progress.get(), [0, 1], ${fill}) };`,
    '});',
    'const label = useAnimatedStyle(() => ({',
    `  color: interpolateColor(progress.get(), [0, 1], ${foreground}),`,
    '}));',
  ].join('\n');

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
    // Selected, the label sits on the light fill and reads that fill's token.
    animated(
      '[theme.colors.surface, theme.colors.primaryLight]',
      '[theme.colors.chipText, animatedTheme.get().colors.onPrimaryLight]',
    ),
    // Another driver: the stops do not meet.
    [
      'const box = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(a.get(), [0, 1], [theme.colors.surface, theme.colors.primary]) }));',
      'const label = useAnimatedStyle(() => ({ color: interpolateColor(b.get(), [0, 1], [theme.colors.onPrimary, theme.colors.textPrimary]) }));',
    ].join('\n'),
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
    {
      // The stop that lands on the light fill names the strong one.
      code: animated(
        '[theme.colors.surface, theme.colors.primaryLight]',
        '[theme.colors.chipText, theme.colors.onPrimary]',
      ),
      errors: ['onTokenNotNamingItsFill'],
    },
    {
      code: [
        'const tab = useAnimatedStyle(() => ({',
        '  backgroundColor: interpolateColor(p.get(), [0, 1], [theme.colors.surface, theme.colors.primary]),',
        "  color: interpolateColor(p.get(), [0, 1], [theme.colors.textPrimary, '#fff']),",
        '}));',
      ].join('\n'),
      errors: ['hardcodedWhite'],
    },
  ],
});
