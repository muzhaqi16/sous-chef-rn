const COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?)\(.*\))$/i;
const NAMED = new Set([
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A colour is a theme token, never a hex, rgb() or named literal.',
      url: 'docs/rules/no-raw-color.md',
    },
    schema: [],
    messages: {
      rawColor:
        "A raw colour ignores the colour scheme and the user's accent override. Read a token (`theme.colors.*` in a stylesheet, `colors.*` from `#/theme/foundations/colors` elsewhere), or add one under `src/theme/`.",
    },
  },
  create(context) {
    const check = (node, value) => {
      const text = value.trim();
      if (COLOR.test(text) || NAMED.has(text.toLowerCase())) {
        context.report({ node, messageId: 'rawColor' });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        // A named colour only counts as a style value, never as prose.
        if (NAMED.has(node.value.toLowerCase())) {
          const parent = node.parent;
          const isStyleValue =
            (parent.type === 'Property' && parent.value === node) ||
            parent.type === 'JSXAttribute' ||
            parent.type === 'AssignmentPattern';
          if (!isStyleValue) return;
          const key =
            parent.type === 'Property'
              ? parent.key.name ?? parent.key.value
              : parent.type === 'JSXAttribute'
              ? parent.name.name
              : parent.left.name;
          if (!/colou?r$/i.test(String(key))) return;
        }
        check(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) {
          check(node, node.quasis[0].value.cooked);
        }
      },
    };
  },
};
