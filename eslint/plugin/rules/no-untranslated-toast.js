const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-untranslated-toast',
  description:
    'Copy reaching a toast or alert is translated: no literals, templates or server messages.',
  checks: [
    {
      messageId: 'literal',
      selector:
        'CallExpression[callee.object.name=/^(toastService|alertService)$/] > Literal[value=/[A-Za-z]{3}/]',
      message:
        'Untranslated string passed to a user-facing toast/alert. Add a key to src/i18n/locales/en.json and pass t(...) — the module-level `t` from #/i18n works outside components.',
    },
    {
      messageId: 'serverMessage',
      selector:
        "CallExpression[callee.object.name=/^(toastService|alertService)$/] MemberExpression[property.name='message']",
      message:
        "Never display a server `message`. Settle the write with `settleMutation` (`present: 'none'` when you show it yourself) and show `failure.body` — it resolves the refused field, then the error code, then your localized fallback.",
    },
    {
      messageId: 'templateLiteral',
      selector:
        'CallExpression[callee.object.name=/^(toastService|alertService)$/] > TemplateLiteral',
      message:
        'Template literal passed to a user-facing toast/alert. Interpolate through i18next instead — t(key, { name }) — so the sentence stays reorderable, and use _one/_other keys for counts rather than appending an "s".',
    },
  ],
});
