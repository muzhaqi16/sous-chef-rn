const TEST_ID_PROP = /^(testID|testIDPrefix|\w+TestID)$/;

/** A literal an id is spelled with, looking through `a ? b : c` and `a || b`. */
function literalIn(node) {
  if (!node) return undefined;
  switch (node.type) {
    // An id has no whitespace; a sentence under a `*TestID` key is not one.
    case 'Literal':
      return (typeof node.value === 'string' && !/\s/.test(node.value)) ||
        node.regex
        ? node
        : undefined;
    case 'TemplateLiteral':
      return node.quasis.some(quasi => /\s/.test(quasi.value.raw))
        ? undefined
        : node;
    case 'ConditionalExpression':
      return literalIn(node.consequent) ?? literalIn(node.alternate);
    case 'LogicalExpression':
      return literalIn(node.left) ?? literalIn(node.right);
    case 'JSXExpressionContainer':
      return literalIn(node.expression);
    default:
      return undefined;
  }
}

/** A fixed string — a literal or an expression-less template — through `?:` and `||`. */
function fixedStringIn(node) {
  if (!node) return undefined;
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? node : undefined;
    case 'TemplateLiteral':
      return node.expressions.length === 0 ? node : undefined;
    case 'ConditionalExpression':
      return fixedStringIn(node.consequent) ?? fixedStringIn(node.alternate);
    case 'LogicalExpression':
      return fixedStringIn(node.left) ?? fixedStringIn(node.right);
    default:
      return undefined;
  }
}

/** `by.<name>(…)`, but not `by.system.<name>(…)`, which reaches OS alerts. */
const isByMatcher = (callee, names) =>
  callee.type === 'MemberExpression' &&
  !callee.computed &&
  callee.object.type === 'Identifier' &&
  callee.object.name === 'by' &&
  callee.property.type === 'Identifier' &&
  names.includes(callee.property.name);

const isPointLiteral = node =>
  node?.type === 'ObjectExpression' &&
  node.properties.some(
    prop =>
      prop.type === 'Property' &&
      !prop.computed &&
      prop.key.type === 'Identifier' &&
      (prop.key.name === 'x' || prop.key.name === 'y'),
  );

/** A Detox tap at a screen point: `tapAtPoint`, `device.tap`/`longPress`, `.tap({ x, y })`. */
function isPointTap(callee, args) {
  if (callee.type !== 'MemberExpression' || callee.computed) return false;
  if (callee.property.type !== 'Identifier') return false;
  const name = callee.property.name;
  if (name === 'tapAtPoint') return true;
  if (name !== 'tap' && name !== 'longPress') return false;
  if (callee.object.type === 'Identifier' && callee.object.name === 'device') {
    return true;
  }
  return isPointLiteral(args[0]);
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A testID comes from its feature registry, never a string, template or regex literal; e2e selects app controls by that id, never by fixed copy or a screen point.',
      url: 'docs/rules/testid-from-registry.md',
    },
    schema: [],
    messages: {
      literalTestID:
        "Spelled testIDs drift between the app and the e2e page objects, and a mismatch only shows as a Detox timeout. Use the feature's `testIDs.ts` (or `src/components/testIDs.ts` for shared components): add the id or a builder there and import it on both sides.",
      literalCopyMatcher:
        "A fixed string under `by.text`/`by.label` is app copy: it fails in every other locale and on every rewording. Select the control with `by.id` and a registry testID (add one to the feature's `testIDs.ts` and render it); `by.text(variable)` stays for data the spec itself entered.",
      pointTap:
        'A tap at a screen point lands on whatever the layout, font scale or keyboard puts there. Tap the element by `by.id` and a registry testID.',
    },
  },
  create(context) {
    const report = node => context.report({ node, messageId: 'literalTestID' });
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        if (!TEST_ID_PROP.test(node.name.name)) return;
        const literal = literalIn(node.value);
        if (literal) report(literal);
      },
      // A destructured prop's default: `testIDPrefix = 'filter-tab'`.
      AssignmentPattern(node) {
        if (node.left.type !== 'Identifier') return;
        if (!TEST_ID_PROP.test(node.left.name)) return;
        const literal = literalIn(node.right);
        if (literal) report(literal);
      },
      Property(node) {
        if (node.computed || node.key.type !== 'Identifier') return;
        if (!TEST_ID_PROP.test(node.key.name)) return;
        const literal = literalIn(node.value);
        if (literal) report(literal);
      },
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (isByMatcher(callee, ['id'])) {
          const literal = literalIn(args[0]);
          if (literal) report(literal);
          return;
        }
        if (isByMatcher(callee, ['text', 'label'])) {
          const fixed = fixedStringIn(args[0]);
          if (fixed)
            context.report({ node: fixed, messageId: 'literalCopyMatcher' });
          return;
        }
        if (isPointTap(callee, args)) {
          context.report({ node, messageId: 'pointTap' });
        }
      },
    };
  },
};
