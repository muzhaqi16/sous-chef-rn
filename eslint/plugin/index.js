/**
 * The project's own lint rules, registered as `sous-chef/*`. Each rule has a
 * page in docs/rules/ and a RuleTester spec in __tests__/lint/rules/;
 * `__tests__/lint/ruleCatalog.test.ts` holds that.
 */
module.exports = {
  meta: { name: 'eslint-plugin-sous-chef' },
  rules: {
    'no-schema-enum-cast': require('./rules/no-schema-enum-cast'),
    'no-module-level-t': require('./rules/no-module-level-t'),
    'no-dated-comment': require('./rules/no-dated-comment'),
    'no-operation-name-literal': require('./rules/no-operation-name-literal'),
    'no-unchecked-domain-literal': require('./rules/no-unchecked-domain-literal'),
    'no-error-message-branching': require('./rules/no-error-message-branching'),
    'no-rendered-server-message': require('./rules/no-rendered-server-message'),
    'testid-from-registry': require('./rules/testid-from-registry'),
    'no-raw-color': require('./rules/no-raw-color'),
    'no-raw-spacing': require('./rules/no-raw-spacing'),
    'text-needs-role': require('./rules/text-needs-role'),
    'quantity-through-formatter': require('./rules/quantity-through-formatter'),
    'no-rendered-enum': require('./rules/no-rendered-enum'),
    'no-t-default-value': require('./rules/no-t-default-value'),
    'no-prose-literal': require('./rules/no-prose-literal'),
    'no-string-keyed-lookup': require('./rules/no-string-keyed-lookup'),
    'no-number-noun-concat': require('./rules/no-number-noun-concat'),
    'queueable-write-is-local-first': require('./rules/queueable-write-is-local-first'),
    'recycling-list-host-is-bounded': require('./rules/recycling-list-host-is-bounded'),
    'hook-returns-no-library-type': require('./rules/hook-returns-no-library-type'),
    'flashlist-declares-scroll-component': require('./rules/flashlist-declares-scroll-component'),
    'no-scrollable-in-bottom-sheet-view': require('./rules/no-scrollable-in-bottom-sheet-view'),
    'rngh-refresh-control-matches-host': require('./rules/rngh-refresh-control-matches-host'),
    'on-fill-text-uses-its-token': require('./rules/on-fill-text-uses-its-token'),
    'selects-key-field-directly': require('./rules/selects-key-field-directly'),
    'animated-node-takes-no-themed-style': require('./rules/animated-node-takes-no-themed-style'),
  },
};
