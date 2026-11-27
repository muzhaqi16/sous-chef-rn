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

/** `theme.colors.X`, or `animatedTheme.get().colors.X` → `X`. */
const themeColor = node =>
  node?.type === 'MemberExpression' &&
  node.property.type === 'Identifier' &&
  node.object.type === 'MemberExpression' &&
  node.object.property.type === 'Identifier' &&
  node.object.property.name === 'colors'
    ? node.property.name
    : undefined;

const isWhite = node =>
  node?.type === 'Literal' &&
  typeof node.value === 'string' &&
  WHITE.test(node.value.trim());

/** The object a style factory returns: `() => ({…})` or `() => { return {…} }`. */
const returnedObject = fn => {
  if (
    fn?.type !== 'ArrowFunctionExpression' &&
    fn?.type !== 'FunctionExpression'
  )
    return undefined;
  if (fn.body.type === 'ObjectExpression') return fn.body;
  if (fn.body.type !== 'BlockStatement') return undefined;
  const returned = fn.body.body.find(
    statement => statement.type === 'ReturnStatement',
  );
  return returned?.argument?.type === 'ObjectExpression'
    ? returned.argument
    : undefined;
};

/** `interpolateColor(progress, inputs, [a, b])`: its driver and its stops. */
const interpolation = (node, sourceCode) => {
  if (
    node?.type !== 'CallExpression' ||
    node.callee.type !== 'Identifier' ||
    node.callee.name !== 'interpolateColor'
  )
    return undefined;
  const [progress, inputs, outputs] = node.arguments;
  if (!progress || !inputs || outputs?.type !== 'ArrayExpression')
    return undefined;
  return {
    driver: `${sourceCode.getText(progress)}|${sourceCode.getText(inputs)}`,
    stops: outputs.elements,
  };
};

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
    const { sourceCode } = context;
    const blocks = [];
    /** Animated colours, by driver: where each stop of a fill and a foreground lands. */
    const animated = new Map();

    const reportPair = (node, token, fill) => {
      if (!token || !fill || !/^on[A-Z]/.test(token)) return;
      const itsFill = fillOfOnToken(token);
      if (itsFill === fill) return;
      context.report({
        node,
        messageId: 'onTokenNotNamingItsFill',
        data: {
          token,
          itsFill,
          fill,
          expected: fill.slice(0, 1).toUpperCase() + fill.slice(1),
        },
      });
    };

    return {
      'CallExpression[callee.property.name="create"][callee.object.name="StyleSheet"]'(
        node,
      ) {
        const [argument] = node.arguments;
        const object =
          argument?.type === 'ObjectExpression'
            ? argument
            : returnedObject(argument);
        for (const property of object?.properties ?? []) {
          if (property.type === 'Property') blocks.push(property.value);
        }
      },

      // A style animated between colours: each stop of its foreground sits on
      // the fill at the same stop, in its own block or in another driven alike.
      'CallExpression[callee.name="useAnimatedStyle"]'(node) {
        const object = returnedObject(node.arguments[0]);
        if (!object) return;
        for (const role of ['backgroundColor', 'color']) {
          const property = propertyNamed(object, role);
          const animation = interpolation(property?.value, sourceCode);
          if (!animation) continue;
          const entry = animated.get(animation.driver) ?? {
            fills: [],
            foregrounds: [],
          };
          entry[role === 'color' ? 'foregrounds' : 'fills'].push({
            property,
            stops: animation.stops,
          });
          animated.set(animation.driver, entry);
        }
      },

      'Program:exit'() {
        const fillOf = block => {
          const background = propertyNamed(block, 'backgroundColor');
          const name = themeColor(background?.value);
          return name && FILL_NAMES.has(name) ? name : undefined;
        };
        const paintsAFill =
          blocks.some(fillOf) ||
          [...animated.values()].some(entry =>
            entry.fills.some(fill =>
              fill.stops.some(stop => FILL_NAMES.has(themeColor(stop))),
            ),
          );

        for (const block of blocks) {
          const color = propertyNamed(block, 'color');
          if (!color) continue;

          if (paintsAFill && isWhite(color.value)) {
            context.report({ node: color, messageId: 'hardcodedWhite' });
            continue;
          }

          reportPair(color, themeColor(color.value), fillOf(block));
        }

        for (const { fills, foregrounds } of animated.values()) {
          for (const foreground of foregrounds) {
            const reported = foreground.stops.some(stop => {
              if (paintsAFill && isWhite(stop)) {
                context.report({
                  node: foreground.property,
                  messageId: 'hardcodedWhite',
                });
                return true;
              }
              return false;
            });
            if (reported) continue;

            for (const fill of fills) {
              foreground.stops.forEach((stop, index) =>
                reportPair(
                  foreground.property,
                  themeColor(stop),
                  themeColor(fill.stops[index]),
                ),
              );
            }
          }
        }
      },
    };
  },
};
