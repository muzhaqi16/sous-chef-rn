const { selectorRule } = require('../selectorRule');

const FUNCTION =
  /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;

/** No enclosing function: the call runs while its module loads. */
const atModuleScope = node => {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (FUNCTION.test(ancestor.type)) return false;
  }
  return true;
};

module.exports = selectorRule({
  name: 'no-module-scope-platform-read',
  description:
    'A platform service is read where it is used, never while a module loads.',
  checks: [
    {
      messageId: 'moduleScopeRead',
      selector: "CallExpression[callee.name='requirePlatform']",
      when: atModuleScope,
      message:
        "Read the platform service inside the function that uses it, e.g. `const secureStore = () => requirePlatform('secureStore')`. A read while the module loads depends on the host installing first and on the bundler's evaluation order: Metro's inline requires hide it, an eager bundler throws `PlatformServiceMissing`.",
    },
  ],
});
