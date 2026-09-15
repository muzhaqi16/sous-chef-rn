/**
 * Whether a node sits in text only a developer reads: an argument (at any
 * depth) to a logger, console, telemetry or error-reporting call, an `Error`
 * constructor, or a `throw`. Shared by the copy rules so their exemptions agree.
 */
const DEVELOPER_OBJECTS =
  /^(logger|console|errorService|Telemetry\w*|telemetry|performance|perf|Sentry|crashlytics|analytics)$/;
const DEVELOPER_FUNCTIONS =
  /^(log|logError|logWarn|logInfo|logDebug|trackEvent|captureException|addBreadcrumb|reportError|invariant|assert\w*|require)$/;

const DEVELOPER_METHODS =
  /^(log|logError|logWarn|logInfo|logDebug|trackError|trackEvent|reportError|captureException|addBreadcrumb)$/;

const calleeIsDeveloperFacing = callee => {
  if (callee.type === 'Identifier')
    return DEVELOPER_FUNCTIONS.test(callee.name);
  if (callee.type !== 'MemberExpression') return false;
  if (
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    DEVELOPER_METHODS.test(callee.property.name)
  ) {
    return true;
  }
  let object = callee.object;
  while (object.type === 'MemberExpression') object = object.object;
  if (object.type === 'CallExpression') {
    return calleeIsDeveloperFacing(object.callee);
  }
  return object.type === 'Identifier' && DEVELOPER_OBJECTS.test(object.name);
};

const isFunction = node =>
  node.type === 'FunctionDeclaration' ||
  node.type === 'FunctionExpression' ||
  node.type === 'ArrowFunctionExpression';

function isDeveloperFacing(node) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (isFunction(parent)) return false;
    if (parent.type === 'ThrowStatement') return true;
    if (
      parent.type === 'NewExpression' &&
      parent.callee.type === 'Identifier' &&
      /Error$/.test(parent.callee.name)
    ) {
      return true;
    }
    if (
      parent.type === 'CallExpression' &&
      parent.callee !== current &&
      calleeIsDeveloperFacing(parent.callee)
    ) {
      return true;
    }
    current = parent;
  }
  return false;
}

module.exports = { isDeveloperFacing };
