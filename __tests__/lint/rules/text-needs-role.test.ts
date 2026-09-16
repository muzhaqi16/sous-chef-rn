import { RuleTester } from 'eslint';
import type { Rule } from 'eslint';
import * as typescriptParser from '@typescript-eslint/parser';
import { testRule } from '#/test-utils/eslintRuleTester';

const IMPORT = "import { Text } from '#components/atoms/Text';\n";
const VARIANTS = [{ readVariants: true }];
const variantSheet = (body: string) =>
  `\nconst styles = StyleSheet.create(theme => ({ ${body} }));`;

testRule('text-needs-role', {
  valid: [
    `${IMPORT}const a = <Text role="body">x</Text>;`,
    `${IMPORT}const b = <Text {...props} />;`,
    `${IMPORT}const c = <Text role={isStrong ? 'bodyStrong' : 'body'} />;`,
    "import { Text } from 'react-native';\nconst d = <Text>x</Text>;",
    "import { Text } from '#components/atoms/Title';\nconst e = <Text />;",
    'const f = <Text>x</Text>;',
    "import type { Text } from '#components/atoms/Text';\nconst g = <Text />;",
    `${IMPORT}const h = <Animated.Text>x</Animated.Text>;`,
    `${IMPORT}const i = <Text role="error" tone="error">x</Text>;`,
    `${IMPORT}const j = <Text role="bodyStrong" tone="danger">Delete</Text>;`,
    `${IMPORT}const k = <Text role={bad ? 'error' : 'caption'} tone={bad ? 'error' : 'secondary'} />;`,
    // A tone or role the rule cannot read is left to review.
    `${IMPORT}const l = <Text role="caption" tone={tone} />;`,
    `${IMPORT}const m = <Text role={role} tone="error" />;`,
    `${IMPORT}const n = <Text role="error" {...props} />;`,
    `${IMPORT}const o = <Text role="caption" style={styles.hint} />;\nconst styles = StyleSheet.create(theme => ({ hint: { color: theme.colors.textSecondary } }));`,
    `${IMPORT}const p = <Text role="caption" style={shared.errorText} />;`,
    // Without the option a variant's colour is not read.
    `${IMPORT}const q = <Text role="caption" style={styles.label} />;${variantSheet(
      'label: { variants: { invalid: { true: { color: theme.colors.error } } } }',
    )}`,
    {
      code: `${IMPORT}const r = <Text role="caption" style={styles.label} />;${variantSheet(
        'label: { variants: { muted: { true: { color: theme.colors.textSecondary } } } }',
      )}`,
      options: VARIANTS,
    },
    // A red variant on a style no Text reads.
    {
      code: `${IMPORT}const s = <View style={styles.badge} />;${variantSheet(
        'badge: { variants: { expired: { true: { color: theme.colors.danger } } } }',
      )}`,
      options: VARIANTS,
    },
  ],
  invalid: [
    { code: `${IMPORT}const a = <Text>x</Text>;`, errors: ['missingRole'] },
    {
      code: `${IMPORT}const b = <Text tone="secondary" style={s.x} />;`,
      errors: ['missingRole'],
    },
    {
      code: "import { Text as AppText } from '#/components/atoms/Text';\nconst c = <AppText>x</AppText>;",
      errors: ['missingRole'],
    },
    {
      code: "import Text from './components/atoms/Text';\nconst d = <Text>x</Text>;",
      errors: ['missingRole'],
    },
    {
      code: `${IMPORT}const e = <Text role="caption">a <Text>b</Text></Text>;`,
      errors: ['missingRole'],
    },
    {
      code: `${IMPORT}const f = <Text role="caption" tone="error">x</Text>;`,
      errors: ['errorToneNeedsErrorRole'],
    },
    {
      code: `${IMPORT}const g = <Text tone="error">x</Text>;`,
      errors: ['missingRole', 'errorToneNeedsErrorRole'],
    },
    {
      code: `${IMPORT}const h = <Text role="label" tone={expired ? 'error' : 'warning'} />;`,
      errors: ['errorToneNeedsErrorRole'],
    },
    {
      code: `${IMPORT}const i = <Text role="error">x</Text>;`,
      errors: ['errorRoleNeedsErrorTone'],
    },
    {
      code: `${IMPORT}const j = <Text role="error" tone="secondary">x</Text>;`,
      errors: ['errorRoleNeedsErrorTone'],
    },
    {
      code: `${IMPORT}const k = <Text role="caption" style={styles.errorText}>x</Text>;\nconst styles = StyleSheet.create(theme => ({ errorText: { color: theme.colors.error, marginTop: 4 } }));`,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const l = <Text role="heading" style={[styles.title, bad && styles.warn]} />;\nconst styles = StyleSheet.create(theme => ({ title: {}, warn: { color: theme.colors.danger } }));`,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const m = <Text role="body" style={{ color: theme.colors.error }} />;`,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const n = <Text role="caption" style={styles.label} />;${variantSheet(
        'label: { marginTop: 4, variants: { invalid: { true: { color: theme.colors.error }, false: {} } } }',
      )}`,
      options: VARIANTS,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const o = <Text role="label" style={[styles.row, styles.status]} />;${variantSheet(
        'row: {}, status: { compoundVariants: [{ expired: true, styles: { color: theme.colors.danger } }] }',
      )}`,
      options: VARIANTS,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const p = <Text role="caption" style={styles.hint(bad)} />;${variantSheet(
        'hint: (bad: boolean) => ({ color: theme.colors.error })',
      )}`,
      options: VARIANTS,
      errors: ['errorColourInStyle'],
    },
    {
      code: `${IMPORT}const q = <Text tone="secondary" style={styles.label} />;${variantSheet(
        'label: { variants: { tone: { error: { color: theme.colors.error }, default: {} } } }',
      )}`,
      options: [{ requireRole: false, readVariants: true }],
      errors: ['errorColourInStyle'],
    },
  ],
});

// The kit's configuration: a wrapper may pass its caller's role through, but
// error copy still pairs role and tone.
new RuleTester({
  languageOptions: {
    parser: typescriptParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}).run(
  'text-needs-role (kit)',
  require('../../../eslint/plugin/rules/text-needs-role') as Rule.RuleModule,
  {
    valid: [
      {
        code: `${IMPORT}const a = <Text tone="secondary">x</Text>;`,
        filename: 'case.tsx',
        options: [{ requireRole: false }],
      },
    ],
    invalid: [
      {
        code: `${IMPORT}const b = <Text tone="error">x</Text>;`,
        filename: 'case.tsx',
        options: [{ requireRole: false }],
        errors: [{ messageId: 'errorToneNeedsErrorRole' }],
      },
    ],
  },
);
