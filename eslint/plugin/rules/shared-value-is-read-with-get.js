/**
 * The members by which a Reanimated shared or derived value is recognised; a
 * plain object with a `value` field has none of the others.
 */
const SHARED_VALUE_MEMBERS = ['value', 'get', 'set', 'modify', 'addListener'];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A shared value is read with `.get()`, never `.value`.',
      url: 'docs/rules/shared-value-is-read-with-get.md',
    },
    schema: [],
    messages: {
      valueRead:
        'Read a shared value with `.get()`, not `.value`. The React Compiler treats a `.value` read as an ordinary property it may cache, and `.get()` is the one access every shared value in this app goes through (writes are `.set()`).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();

    const isSharedValue = type =>
      (type.isUnion() ? type.types : [type]).some(member =>
        SHARED_VALUE_MEMBERS.every(name =>
          checker.getPropertyOfType(member, name),
        ),
      );

    return {
      MemberExpression(node) {
        if (
          node.computed ||
          node.property.type !== 'Identifier' ||
          node.property.name !== 'value'
        ) {
          return;
        }
        const { parent } = node;
        // A write is `no-restricted-syntax`'s `sharedValueAssignment`.
        if (
          (parent.type === 'AssignmentExpression' && parent.left === node) ||
          parent.type === 'UpdateExpression'
        ) {
          return;
        }
        const type = checker.getNonNullableType(
          checker.getTypeAtLocation(
            services.esTreeNodeToTSNodeMap.get(node.object),
          ),
        );
        if (isSharedValue(type)) {
          context.report({ node: node.property, messageId: 'valueRead' });
        }
      },
    };
  },
};
