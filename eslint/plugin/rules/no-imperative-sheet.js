const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-imperative-sheet',
  description:
    'Drive a bottom sheet with its visible prop, not present()/dismiss().',
  checks: [
    {
      messageId: 'imperativeSheet',
      selector:
        "CallExpression[callee.property.name=/^(present|dismiss)$/][arguments.length=0]:not([callee.object.name='Keyboard'])",
      message:
        'Drive a sheet with the `visible` prop through `Sheet` / `useStandardBottomSheet`, not `present()` / `dismiss()`. Calling `dismiss()` on a modal that was never presented wedges it closed for the rest of the session — the hook guards that, a raw ref does not.',
    },
  ],
});
