const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-module-level-t',
  description:
    "A file that renders translates with the hook's t, not the module-level one.",
  checks: [
    {
      messageId: 'moduleLevelT',
      selector:
        "ImportDeclaration[source.value='#/i18n'] > ImportSpecifier[imported.name='t'][local.name='t']",
      message:
        "Use `const { t } = useTranslation()` in a file that renders — the module-level `t` does not subscribe to language changes. If this file genuinely needs the module-level helper (a class component, or module-scope code), import it aliased: `import { t as tGlobal } from '#/i18n'`, so a bare `t(...)` in JSX is unambiguously the hook's.",
    },
  ],
});
