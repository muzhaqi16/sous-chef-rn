const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-font-scale-override',
  description: 'Never cap or disable font scaling per element.',
  checks: [
    {
      messageId: 'maxFontSizeMultiplier',
      selector: "JSXAttribute[name.name='maxFontSizeMultiplier']",
      message:
        'The font-scale ceiling is global — `MAX_FONT_SCALE` in #/theme/foundations/type, applied in the `Text` atom as `theme.maxFontScaleMultiplier`. A per-element cap bounds the OS scale only, leaving its product with the app preference unbounded.',
    },
    {
      messageId: 'allowFontScaling',
      selector:
        "JSXAttribute[name.name='allowFontScaling'][value.expression.value=false]",
      message:
        'Never disable font scaling — every role must respond to the OS text-size setting. If the layout cannot take the largest size, give the text room or fewer glyphs; the combined ceiling already bounds how far it grows.',
    },
  ],
});
