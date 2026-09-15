const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-modal-props-override',
  description:
    "Do not override onChange or animatedIndex after spreading useStandardBottomSheet's modalProps.",
  checks: [
    {
      messageId: 'modalPropsOverride',
      selector:
        "JSXSpreadAttribute[argument.name='modalProps'] ~ JSXAttribute[name.name=/^(onChange|animatedIndex)$/]",
      message:
        "Do not override `onChange` or `animatedIndex` after `{...modalProps}` — useStandardBottomSheet supplies both: a composed onChange (drives the global backdrop claim) and the animatedIndex SharedValue (drives backdrop opacity in lockstep with the sheet). Overriding either silently breaks the dim layer. Forward via the hook's options API: `useStandardBottomSheet({ ..., onChange: handler })`. (Other props like `snapPoints`, `keyboardBlurBehavior`, `onDismiss` can be overridden safely.)",
    },
  ],
});
