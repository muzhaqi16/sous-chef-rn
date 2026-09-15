const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-border-width-literal',
  description:
    'Border widths come from theme.borderWidth, never a numeric literal.',
  checks: [
    {
      messageId: 'borderWidthLiteral',
      selector:
        "Property[key.name=/^border(Top|Bottom|Left|Right|Start|End)?Width$/][value.type='Literal'][value.raw=/^[0-9]/]",
      message:
        'Use a named step of `theme.borderWidth` (none | hairline | thin | medium | thick | heavy) rather than a literal. A literal is a width the theme cannot change, and it is what made 106 files each pick their own hairline.',
    },
  ],
});
