import { testRule } from '#/test-utils/eslintRuleTester';

testRule('local-write-is-deterministic', {
  valid: [
    'export const write = { capture: () => ({ now: new Date().toISOString() }) };',
    'export const write = { apply: (cache, { inputs }) => cache.writeFragment({ data: inputs.now }) };',
    'const later = () => new Date(); export const write = { apply: () => {} };',
    'export const write = { commit: cache => cache.modify({ fields: (_, { DELETE }) => DELETE }) };',
  ],
  invalid: [
    {
      code: 'export const write = { apply: () => new Date() };',
      errors: ['outsideInput'],
    },
    {
      code: 'export const write = { apply: () => Date.now() };',
      errors: ['outsideInput'],
    },
    {
      code: 'export const write = { apply: () => generateEntityId() };',
      errors: ['outsideInput'],
    },
    {
      code: 'export const write = { commit: () => useStore.getState() };',
      errors: ['outsideInput'],
    },
    {
      code: 'export const write = { apply: cache => cache.evict({ id }) };',
      errors: ['evictsInLayer'],
    },
    {
      code: 'export const write = { commit: cache => cache.gc() };',
      errors: ['evictsInLayer'],
    },
  ],
});
