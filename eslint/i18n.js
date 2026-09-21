/**
 * Untranslated copy in JSX. `i18next/no-literal-string` walks JSXText, so a
 * sentence is caught however JSX fragments it around expressions. Copy in a
 * `.ts` toast or alert is caught by `sous-chef/no-untranslated-toast` instead,
 * and copy reaching JSX through a variable by `sous-chef/no-prose-literal`.
 */

// The props that carry copy. Design-system props (`tone`, `name`, `testID`,
// `icon`) take enum-ish identifiers, never copy. `unit` is deliberately absent:
// `unit="g"` is a measurement symbol.
const COPY_ATTRIBUTES = [
  'title',
  'label',
  'placeholder',
  'message',
  'description',
  'subtitle',
  'text',
  'emptyText',
  'emptyMessage',
  'emptyTitle',
  'header',
  'heading',
  'caption',
  'hint',
  'helperText',
  'errorText',
  'confirmText',
  'cancelText',
  'confirmLabel',
  'cancelLabel',
  'buttonText',
  'buttonLabel',
  'actionLabel',
  'accessibilityLabel',
  'accessibilityHint',
  'modalTitle',
  'modalSearchPlaceholder',
  'modalEmptyText',
  'searchPlaceholder',
];

const NO_LITERAL_STRING = [
  'error',
  {
    mode: 'jsx-only',
    // An INCLUDE list.
    'jsx-attributes': {
      include: COPY_ATTRIBUTES,
    },
    // Replaces the plugin's defaults wholesale, so they are repeated here —
    // drop `t` and every translated call gets flagged for its key string.
    callees: {
      exclude: [
        'i18n(ext)?',
        't',
        // The module-level helper's required alias in a rendering file.
        'tGlobal',
        'require',
        'addEventListener',
        'removeEventListener',
        'postMessage',
        'getElementById',
        'dispatch',
        'commit',
        'includes',
        'indexOf',
        'endsWith',
        'startsWith',
        'format',
        'formatISO',
        'parse',
        'trackEvent',
      ],
    },
    words: {
      // Also replaces the plugin default, so both entries are load-bearing.
      exclude: [
        // Any run with no letter in any script: emoji (including the U+FE0F
        // variation selector the plugin default misses), symbol glyphs used as
        // controls, currency, numbers and punctuation.
        /^[^\p{L}]+$/u,
        // The product name ships untranslated in every locale.
        'Sous Chef',
      ],
    },
    message:
      'Hardcoded user-facing string. Add a key to src/i18n/locales/en.json (English only — translators fill es/it/sq) and render it via t(). For counts use i18next interpolation with {{count}} and _one/_other plural keys; give each plural form its own whole sentence rather than interpolating a word into one',
  },
];

// Shared by the i18n rules: a copy that under-matches passes what it should catch.
const SINK_SERVICES = /^(toastService|alertService)$/;
const TRANSLATE_FUNCTIONS = /^(t|tGlobal|translate)$/;
const COPY_VARIABLE =
  /^(label|text|title|subtitle|message|description|caption|hint|placeholder)$|[a-z0-9](Label|Text|Title|Subtitle|Message|Description|Caption|Hint|Placeholder|Display)$/;
const DISPLAY_FUNCTION =
  /^format|(Label|Text|Title|Subtitle|Message|Description|Caption|Display)$/;

module.exports = {
  NO_LITERAL_STRING,
  COPY_ATTRIBUTES,
  SINK_SERVICES,
  TRANSLATE_FUNCTIONS,
  COPY_VARIABLE,
  DISPLAY_FUNCTION,
};
