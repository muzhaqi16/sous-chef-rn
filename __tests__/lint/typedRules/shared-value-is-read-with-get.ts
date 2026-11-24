import { testTypedRule } from '#/test-utils/eslintRuleTester';

const REANIMATED =
  "import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';\n";

testTypedRule('shared-value-is-read-with-get', {
  valid: [
    `${REANIMATED}export function useX() {\n  const sv = useSharedValue(0);\n  return useDerivedValue(() => sv.get() + 1);\n}`,
    // A plain object's `value` is not a shared value.
    'declare const option: { value: string; label: string };\nexport const v = option.value;',
    // A write is the restricted-syntax entry's.
    `${REANIMATED}export function useX() {\n  const sv = useSharedValue(0);\n  sv.value = 1;\n}`,
  ],
  invalid: [
    {
      code: `${REANIMATED}export function useX() {\n  const sv = useSharedValue(0);\n  return useDerivedValue(() => sv.value + 1);\n}`,
      errors: ['valueRead'],
    },
    {
      code: `${REANIMATED}export function useX() {\n  const sv = useSharedValue(0);\n  const derived = useDerivedValue(() => sv.get() * 2);\n  return derived.value;\n}`,
      errors: ['valueRead'],
    },
    {
      code: `${REANIMATED}declare const slots: { sv: SharedValue<number> }[];\nexport const max = Math.max(...slots.map(entry => entry.sv.value));`,
      errors: ['valueRead'],
    },
    {
      code: `${REANIMATED}declare const maybe: SharedValue<number> | undefined;\nexport const v = maybe?.value;`,
      errors: ['valueRead'],
    },
  ],
});
