/** Fills whose foreground must come from the matching `on*` token. */
const FILL_NAMES = new Set([
  'primary',
  'danger',
  'error',
  'success',
  'warning',
  'info',
]);

const WHITE = /^(#fff(fff)?|white|rgba?\(\s*255\s*,\s*255\s*,\s*255[^)]*\))$/i;

/** The fill an `on*` token names — `onPrimary` belongs to `primary`. */
const fillOfOnToken = token => token.slice(2, 3).toLowerCase() + token.slice(3);

const propertyNamed = (object, name) =>
  object.type === 'ObjectExpression'
    ? object.properties.find(
        property =>
          property.type === 'Property' &&
          property.key.type === 'Identifier' &&
          property.key.name === name,
      )
    : undefined;

/** `theme.colors.X` → `X`. */
const themeColor = node =>
  node?.type === 'MemberExpression' &&
  node.property.type === 'Identifier' &&
  node.object.type === 'MemberExpression' &&
  node.object.property.type === 'Identifier' &&
  node.object.property.name === 'colors'
    ? node.property.name
    : undefined;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Text on a fill reads that fill's own `on*` token.",
      url: 'docs/rules/on-fill-text-uses-its-token.md',
    },
    schema: [],
    messages: {
      hardcodedWhite:
        "This file paints a `theme.colors` fill, and this style hardcodes a white foreground. The fill is user-overridable and the foreground follows its luminance, so white is wrong for four of the seven pickable brand colours. Read the fill's own token — `onPrimary`, `onError` — or `onScrim` over a ground the theme does not paint. There is no `colors.white`.",
      onTokenNotNamingItsFill:
        '`{{token}}` belongs to `{{itsFill}}`, but this style fills with `{{fill}}`. It reads as correct — it is a token, not a literal — and inverts with whichever fill it IS named for. Use `on{{expected}}`.',
    },
  },
  create(context) {
    const blocks = [];

    return {
      'CallExpression[callee.property.name="create"][callee.object.name="StyleSheet"]'(
        node,
      ) {
        const [argument] = node.arguments;
        const object =
          argument?.type === 'ObjectExpression'
            ? argument
            : argument?.type === 'ArrowFunctionExpression' &&
              argument.body.type === 'ObjectExpression'
            ? argument.body
            : undefined;
        for (const property of object?.properties ?? []) {
          if (property.type === 'Property') blocks.push(property.value);
        }
      },

      'Program:exit'() {
        const fillOf = block => {
          const background = propertyNamed(block, 'backgroundColor');
          const name = themeColor(background?.value);
          return name && FILL_NAMES.has(name) ? name : undefined;
        };
        const paintsAFill = blocks.some(fillOf);

        for (const block of blocks) {
          const color = propertyNamed(block, 'color');
          if (!color) continue;

          if (
            paintsAFill &&
            color.value.type === 'Literal' &&
            typeof color.value.value === 'string' &&
            WHITE.test(color.value.value.trim())
          ) {
            context.report({ node: color, messageId: 'hardcodedWhite' });
            continue;
          }

          const token = themeColor(color.value);
          const fill = fillOf(block);
          if (!token || !fill || !/^on[A-Z]/.test(token)) continue;
          const itsFill = fillOfOnToken(token);
          if (itsFill === fill) continue;
          context.report({
            node: color,
            messageId: 'onTokenNotNamingItsFill',
            data: {
              token,
              itsFill,
              fill,
              expected: fill.slice(0, 1).toUpperCase() + fill.slice(1),
            },
          });
        }
      },
    };
  },
};
