import { testRule } from '#/test-utils/eslintRuleTester';

// The StyleSheet sits BELOW the JSX, as it does in every file here: the rule
// must not judge a host before it has seen the keys that host names.
const withStyles = (jsx: string, styles: string) =>
  `const C = () => (${jsx});\nconst styles = StyleSheet.create(theme => (${styles}));\n`;

testRule('recycling-list-host-is-bounded', {
  valid: [
    withStyles(
      '<View style={styles.list}><FlashList data={rows} /></View>',
      '{ list: { flex: 1 } }',
    ),
    withStyles(
      '<View style={styles.list}><FlashList data={rows} /></View>',
      '{ list: { height: 320 } }',
    ),
    withStyles(
      '<View style={styles.list}><FlashList data={rows} /></View>',
      "{ list: { position: 'absolute' } }",
    ),
    // One of several applied styles bounds it.
    withStyles(
      '<View style={[styles.pad, styles.list]}><FlashList data={rows} /></View>',
      '{ pad: { padding: 8 }, list: { flexGrow: 1 } }',
    ),
    // An inline object counts too.
    'const C = () => (<View style={{ flex: 1 }}><FlashList data={rows} /></View>);',
    // Not a plain view: a provider renders no view of its own.
    withStyles(
      '<ListProvider style={styles.pad}><FlashList data={rows} /></ListProvider>',
      '{ pad: { padding: 8 } }',
    ),
  ],
  invalid: [
    {
      code: withStyles(
        '<View style={styles.pad}><FlashList data={rows} /></View>',
        '{ pad: { padding: 8 } }',
      ),
      errors: ['unboundedHost'],
    },
    {
      code: withStyles(
        '<Animated.View style={styles.pad}><FlashList data={rows} /></Animated.View>',
        '{ pad: { gap: 4 } }',
      ),
      errors: ['unboundedHost'],
    },
    {
      // `minHeight` is not a bound: the view still sizes to its children.
      code: withStyles(
        '<View style={styles.pad}><FlashList data={rows} /></View>',
        '{ pad: { minHeight: 40 } }',
      ),
      errors: ['unboundedHost'],
    },
  ],
});
