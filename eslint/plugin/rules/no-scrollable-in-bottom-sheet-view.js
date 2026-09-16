/** Tags that scroll, and so need a host that bounds their height. */
const SCROLLABLES = new Set([
  'FlashList',
  'BottomSheetScrollView',
  'BottomSheetFlatList',
  'BottomSheetFormScrollView',
  'BottomSheetScrollable',
]);

const tagName = node =>
  node.type === 'JSXIdentifier'
    ? node.name
    : node.type === 'JSXMemberExpression'
    ? tagName(node.property)
    : '';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A scrollable is never nested inside a BottomSheetView.',
      url: 'docs/rules/no-scrollable-in-bottom-sheet-view.md',
    },
    schema: [],
    messages: {
      nested:
        '`<{{tag}}>` cannot scroll inside `<BottomSheetView>`. Its own style is absolute with `left`, `top` and `right` but no bottom and no height, and gorhom composes it AFTER yours, so a `flex: 1` you pass loses. `handleSettingScrollable` also registers SCROLLABLE_TYPE.VIEW after the list registers itself, so the sheet loses scrollable arbitration too. Put the list in a plain `View` carrying `flex: 1` instead. A list carrying an explicit `maxHeight` merely gets away with it.',
    },
  },
  create(context) {
    return {
      'JSXElement[openingElement.name.name="BottomSheetView"]'(node) {
        const visit = child => {
          if (child.type === 'JSXElement') {
            const tag = tagName(child.openingElement.name);
            if (SCROLLABLES.has(tag)) {
              context.report({
                node: child.openingElement,
                messageId: 'nested',
                data: { tag },
              });
            }
          }
          for (const grandchild of child.children ?? []) {
            if (grandchild.type === 'JSXElement') visit(grandchild);
            else if (
              grandchild.type === 'JSXExpressionContainer' &&
              grandchild.expression
            ) {
              const walk = expression => {
                if (!expression || typeof expression.type !== 'string') return;
                if (expression.type === 'JSXElement') return visit(expression);
                for (const key of [
                  'consequent',
                  'alternate',
                  'right',
                  'body',
                ]) {
                  walk(expression[key]);
                }
              };
              walk(grandchild.expression);
            }
          }
        };
        node.children.forEach(child => {
          if (child.type === 'JSXElement') visit(child);
          else if (child.type === 'JSXExpressionContainer') {
            const walk = expression => {
              if (!expression || typeof expression.type !== 'string') return;
              if (expression.type === 'JSXElement') return visit(expression);
              for (const key of ['consequent', 'alternate', 'right', 'body']) {
                walk(expression[key]);
              }
            };
            walk(child.expression);
          }
        });
      },
    };
  },
};
