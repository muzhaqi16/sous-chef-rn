const ts = require('typescript');

const QUANTITY_NAME = /quantity|amount|qty/i;
const ARITHMETIC = new Set(['+', '-', '*', '/', '%']);
// i18next selects the plural form from `count`, so it must stay a number.
const PLURAL_KEY = 'count';

const nameOf = node => {
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression') return undefined;
  if (!node.computed) return node.property.name;
  return node.property.type === 'Literal'
    ? String(node.property.value)
    : undefined;
};

const isTranslateCall = node =>
  (node.callee.type === 'Identifier' &&
    (node.callee.name === 't' || node.callee.name === 'tGlobal')) ||
  (node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.name === 't');

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A quantity reaches the screen through formatQuantityForDisplay, never as a raw number.',
      url: 'docs/rules/quantity-through-formatter.md',
    },
    schema: [],
    messages: {
      rawQuantity:
        '`{{name}}` is a raw number reaching the screen, so 1.25 reads "1.25" and a converted 177.4412 reads "177.4412". Render it through `QuantityDisplay`, `formatQuantityForDisplay` or `formatQuantityDisplay` (`#/utils/formatQuantity`).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();

    const typeParts = node => {
      const type = checker.getTypeAtLocation(
        services.esTreeNodeToTSNodeMap.get(node),
      );
      return type.isUnion() ? type.types : [type];
    };

    const isNumber = node => {
      const present = typeParts(node).filter(
        part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)),
      );
      return (
        present.length > 0 &&
        present.every(part => part.flags & ts.TypeFlags.NumberLike)
      );
    };

    const isString = node =>
      typeParts(node).every(
        part =>
          part.flags &
          (ts.TypeFlags.StringLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Undefined),
      );

    const report = node =>
      context.report({
        node,
        messageId: 'rawQuantity',
        data: { name: context.sourceCode.getText(node) },
      });

    /** Reports each quantity-named number the rendered value is built from. */
    const check = node => {
      switch (node.type) {
        case 'Identifier':
        case 'MemberExpression': {
          const name = nameOf(node);
          if (name && QUANTITY_NAME.test(name) && isNumber(node)) report(node);
          return;
        }
        case 'ChainExpression':
        case 'TSNonNullExpression':
        case 'TSAsExpression':
          check(node.expression);
          return;
        case 'TemplateLiteral':
          node.expressions.forEach(check);
          return;
        case 'ConditionalExpression':
          check(node.consequent);
          check(node.alternate);
          return;
        case 'LogicalExpression':
          // `qty && <X />` renders the right side; the left is a guard.
          if (node.operator !== '&&') check(node.left);
          check(node.right);
          return;
        case 'BinaryExpression':
          if (ARITHMETIC.has(node.operator)) {
            check(node.left);
            check(node.right);
          }
          return;
        case 'UnaryExpression':
          if (node.operator === '-' || node.operator === '+') {
            check(node.argument);
          }
          return;
        default:
          // A call's result is its own formatting; anything else is not text.
          return;
      }
    };

    return {
      JSXExpressionContainer(node) {
        if (node.expression.type === 'JSXEmptyExpression') return;
        const parent = node.parent;
        if (parent.type === 'JSXElement' || parent.type === 'JSXFragment') {
          check(node.expression);
        } else if (
          parent.type === 'JSXAttribute' &&
          isString(node.expression)
        ) {
          // A number-typed prop is handed on as a number, not shown.
          check(node.expression);
        }
      },
      CallExpression(node) {
        if (!isTranslateCall(node)) return;
        const options = node.arguments[1];
        if (options?.type !== 'ObjectExpression') return;
        for (const property of options.properties) {
          if (property.type !== 'Property') continue;
          if (!property.computed && nameOf(property.key) === PLURAL_KEY)
            continue;
          check(property.value);
        }
      },
    };
  },
};
