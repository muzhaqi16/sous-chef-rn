/** A `View` that sizes to its children offers no height for a list to claim. */
const BOUNDING_PROPERTIES = new Set([
  'height',
  'flex',
  'flexGrow',
  'flexBasis',
]);

/**
 * A context provider or a template renders no view of its own, so its tag says
 * nothing about the height reaching the list.
 */
const PLAIN_VIEWS = new Set(['View', 'Animated.View']);

const tagName = node =>
  node.type === 'JSXIdentifier'
    ? node.name
    : node.type === 'JSXMemberExpression'
    ? `${tagName(node.object)}.${tagName(node.property)}`
    : '';

const boundsHeight = object =>
  object?.type === 'ObjectExpression' &&
  object.properties.some(property => {
    if (property.type !== 'Property' || property.key.type !== 'Identifier') {
      return false;
    }
    if (BOUNDING_PROPERTIES.has(property.key.name)) return true;
    return (
      property.key.name === 'position' &&
      property.value.type === 'Literal' &&
      property.value.value === 'absolute'
    );
  });

/** The object `StyleSheet.create` is given, through a theme callback or not. */
function stylesheetObject(node) {
  const [argument] = node.arguments;
  if (!argument) return undefined;
  if (argument.type === 'ObjectExpression') return argument;
  if (
    argument.type === 'ArrowFunctionExpression' &&
    argument.body.type === 'ObjectExpression'
  ) {
    return argument.body;
  }
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A recycling list is bounded by the view that hosts it.',
      url: 'docs/rules/recycling-list-host-is-bounded.md',
    },
    schema: [],
    messages: {
      unboundedHost:
        "<{{host}}> sizes to its children, so the FlashList inside it resolves to zero height — no rows, no error, and nothing a test asserting on data or props can see. FlashList's root is `flex: 1`, so `flexBasis: 0`: give the host a `height`, `flex`, `flexGrow`, `flexBasis` or absolute position. (`FlatList` survives the same container because RN's ScrollView base style uses `flexBasis: auto`, which is why swapping one for the other empties a picker that worked.)",
    },
  },
  create(context) {
    /** Style key → its object literal, for every `StyleSheet.create` in file. */
    const styles = new Map();
    const hosts = [];

    return {
      'CallExpression[callee.property.name="create"][callee.object.name="StyleSheet"]'(
        node,
      ) {
        const object = stylesheetObject(node);
        for (const property of object?.properties ?? []) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier'
          ) {
            styles.set(property.key.name, property.value);
          }
        }
      },

      // Collected, not reported: the StyleSheet usually sits below the JSX, so
      // the keys a host names are not known until the file has been walked.
      'JSXElement[openingElement.name.name="FlashList"]'(node) {
        let host = node.parent;
        while (host && host.type !== 'JSXElement') host = host.parent;
        if (!host) return;

        const label = tagName(host.openingElement.name);
        if (!PLAIN_VIEWS.has(label)) return;

        const style = host.openingElement.attributes.find(
          attribute =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'style',
        );
        if (!style?.value || style.value.type !== 'JSXExpressionContainer') {
          return;
        }

        // Every style this host applies: `styles.x`, `[styles.x, …]`, or inline.
        const collect = (expression, applied) => {
          if (!expression) return;
          if (expression.type === 'ArrayExpression') {
            expression.elements.forEach(element => collect(element, applied));
          } else if (
            expression.type === 'MemberExpression' &&
            expression.object.type === 'Identifier' &&
            expression.object.name === 'styles' &&
            expression.property.type === 'Identifier'
          ) {
            applied.push(styles.get(expression.property.name));
          } else if (expression.type === 'ObjectExpression') {
            applied.push(expression);
          }
        };

        hosts.push({ node: host.openingElement, label, collect, style });
      },

      'Program:exit'() {
        for (const { node, label, collect, style } of hosts) {
          const applied = [];
          collect(style.value.expression, applied);
          if (applied.some(boundsHeight)) continue;
          context.report({
            node,
            messageId: 'unboundedHost',
            data: { host: label },
          });
        }
      },
    };
  },
};
