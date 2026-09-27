import { testRule } from '#/test-utils/eslintRuleTester';

// The StyleSheet sits BELOW the JSX, as it does in every file here: the rule
// must not judge a node before it has seen the keys that node names.
const withStyles = (body: string, jsx: string, styles: string) =>
  `const C = () => {\n${body}\nreturn (${jsx});\n};\nconst styles = StyleSheet.create(theme => (${styles}));\n`;

const ANIMATED = 'const fade = useAnimatedStyle(() => ({ opacity: 1 }));';

testRule('animated-node-takes-no-themed-style', {
  valid: [
    // Structure only: the key reads no theme.
    withStyles(
      ANIMATED,
      '<Animated.View style={[styles.fill, fade]} />',
      "{ fill: { flex: 1, position: 'absolute' } }",
    ),
    // A themed key on a node with no animated style.
    withStyles(
      ANIMATED,
      '<View style={styles.card} />',
      '{ card: { backgroundColor: theme.colors.surface } }',
    ),
    // The themed style on a non-animated child.
    withStyles(
      ANIMATED,
      '<Animated.View style={[styles.fill, fade]}><View style={styles.card} /></Animated.View>',
      '{ fill: { flex: 1 }, card: { backgroundColor: theme.colors.surface } }',
    ),
    // RN's plain fill objects are not linked to the theme.
    withStyles(
      ANIMATED,
      '<Animated.View style={[StyleSheet.absoluteFill, fade]} />',
      '{}',
    ),
  ],
  invalid: [
    {
      code: withStyles(
        ANIMATED,
        '<Animated.View style={[styles.card, fade]} />',
        '{ card: { backgroundColor: theme.colors.surface } }',
      ),
      errors: ['themedStyle'],
    },
    {
      // A themed key behind a condition, and a dynamic style reading the theme.
      code: withStyles(
        ANIMATED,
        '<Animated.View style={[flag && styles.card, styles.pad(2), fade]} />',
        '{ card: { borderRadius: theme.radii.lg }, pad: n => ({ padding: theme.spacing.md * n }) }',
      ),
      errors: ['themedStyle', 'themedStyle'],
    },
    {
      // An animated style that arrives through a prop or a hook keeps its name.
      code: withStyles(
        '',
        '<Animated.View style={[styles.card, animatedSlideStyle]} />',
        '{ card: { marginBottom: theme.layout.rowGap } }',
      ),
      errors: ['themedStyle'],
    },
    {
      // Another file's stylesheet cannot be read from here.
      code: `import { commonStyles } from '#/styles/commonStyles';\n${withStyles(
        ANIMATED,
        '<Animated.View style={[commonStyles.rowWrapper, fade]} />',
        '{}',
      )}`,
      errors: ['importedStyle'],
    },
  ],
});
