const { selectorRule } = require('../selectorRule');

module.exports = selectorRule({
  name: 'no-inline-import-type',
  description:
    'Import types at the top of the file, not through inline import() types.',
  checks: [
    {
      messageId: 'inlineImportType',
      selector: 'TSImportType',
      message:
        'Avoid inline import() types. Import the type at the top of the file instead.',
    },
  ],
});
