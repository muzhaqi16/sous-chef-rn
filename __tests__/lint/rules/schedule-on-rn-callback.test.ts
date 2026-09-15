import { testRule } from '#/test-utils/eslintRuleTester';

testRule('schedule-on-rn-callback', {
  valid: ['scheduleOnRN(handleDismiss);', 'scheduleOnRN(handleSelect, id);'],
  invalid: [
    { code: 'scheduleOnRN(() => {});', errors: ['inlineCallback'] },
    { code: 'scheduleOnRN(function named() {});', errors: ['inlineCallback'] },
    { code: 'scheduleOnRN(fn, 1, 2);', errors: ['tooManyArguments'] },
  ],
});
