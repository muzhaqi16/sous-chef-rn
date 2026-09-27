/**
 * An animated style reaches a node as a `useAnimatedStyle` binding, or through a
 * prop or hook return that keeps the `…animated…Style` name.
 */
const ANIMATED_STYLE_NAME = /[aA]nimated\w*Style$/;

/** Plain RN objects, never linked to the theme. */
const STYLESHEET_IMPORTS = new Set(['StyleSheet']);

const isStyleSheetCreate = node =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'StyleSheet' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'create';

/** Whether any identifier under `node` is one of `names`. */
function reads(node, names) {
  if (!node || typeof node.type !== 'string') return false;
  if (node.type === 'Identifier' && names.has(node.name)) return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      if (value.some(child => reads(child, names))) return true;
    } else if (value && typeof value.type === 'string' && reads(value, names)) {
      return true;
    }
  }
  return false;
}

/** Style key → whether its definition reads the factory's `theme` or `rt`. */
function themedKeys(call) {
  const keys = new Map();
  const [argument] = call.arguments;
  let object = argument;
  const params = new Set();
  if (
    argument?.type === 'ArrowFunctionExpression' ||
    argument?.type === 'FunctionExpression'
  ) {
    argument.params.forEach(param => {
      if (param.type === 'Identifier') params.add(param.name);
    });
    object = argument.body;
  }
  if (object?.type !== 'ObjectExpression') return keys;
  for (const property of object.properties) {
    if (property.type !== 'Property' || property.key.type !== 'Identifier') {
      continue;
    }
    keys.set(property.key.name, reads(property.value, params));
  }
  return keys;
}

/** The entries a `style` expression can apply. */
function entries(expression, into) {
  if (!expression) return into;
  if (expression.type === 'ArrayExpression') {
    expression.elements.forEach(element => entries(element, into));
  } else if (expression.type === 'LogicalExpression') {
    entries(expression.right, into);
  } else if (expression.type === 'ConditionalExpression') {
    entries(expression.consequent, into);
    entries(expression.alternate, into);
  } else {
    into.push(expression);
  }
  return into;
}

/** `sheet.key` or `sheet.key(args)` → { sheet, key }. */
function sheetMember(entry) {
  const member = entry.type === 'CallExpression' ? entry.callee : entry;
  if (
    member.type === 'MemberExpression' &&
    member.object.type === 'Identifier' &&
    member.property.type === 'Identifier'
  ) {
    return { sheet: member.object.name, key: member.property.name };
  }
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A node Reanimated animates takes no Unistyles style that reads the theme.',
      url: 'docs/rules/animated-node-takes-no-themed-style.md',
    },
    schema: [],
    messages: {
      themedStyle:
        "`{{sheet}}.{{key}}` reads the theme, and this node also takes an animated style. Unistyles links reanimated's React-side copy of the animated values to a themed node and writes that stale copy back over the animation. Read the theme values in a theme-only `useAnimatedStyle` over `useAnimatedTheme()`, or move them to a non-animated parent or child.",
      importedStyle:
        '`{{sheet}}.{{key}}` comes from another file, so whether it reads the theme is not visible here, and this node also takes an animated style. Put it on a non-animated parent or child.',
    },
  },
  create(context) {
    /** Stylesheet binding → its themed keys. */
    const sheets = new Map();
    const imported = new Set();
    const animated = new Set();
    const hosts = [];

    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          if (!STYLESHEET_IMPORTS.has(specifier.local.name)) {
            imported.add(specifier.local.name);
          }
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return;
        if (isStyleSheetCreate(node.init)) {
          sheets.set(node.id.name, themedKeys(node.init));
        } else if (
          node.init?.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'useAnimatedStyle'
        ) {
          animated.add(node.id.name);
        }
      },

      // Collected, not judged: the StyleSheet usually sits below the JSX.
      'JSXAttribute[name.name="style"]'(node) {
        if (node.value?.type === 'JSXExpressionContainer') {
          hosts.push(node);
        }
      },

      'Program:exit'() {
        for (const host of hosts) {
          const applied = entries(host.value.expression, []);
          const takesAnimatedStyle = applied.some(
            entry =>
              entry.type === 'Identifier' &&
              (animated.has(entry.name) ||
                ANIMATED_STYLE_NAME.test(entry.name)),
          );
          if (!takesAnimatedStyle) continue;

          for (const entry of applied) {
            const member = sheetMember(entry);
            if (!member) continue;
            const keys = sheets.get(member.sheet);
            if (keys?.get(member.key)) {
              context.report({
                node: entry,
                messageId: 'themedStyle',
                data: member,
              });
            } else if (!keys && imported.has(member.sheet)) {
              context.report({
                node: entry,
                messageId: 'importedStyle',
                data: member,
              });
            }
          }
        }
      },
    };
  },
};
