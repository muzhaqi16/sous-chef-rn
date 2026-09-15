// An ISO date outside a `code span`; a span holds an example value, not a timestamp.
const DATE = /\b20\d{2}-[01]\d-[0-3]\d\b/;
const CODE_SPAN = /`[^`]*`/g;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A comment describes the code as it is, so it carries no date.',
      url: 'docs/rules/no-dated-comment.md',
    },
    schema: [],
    messages: {
      datedComment:
        'A dated comment is a change log: what changed and when belongs in git and the PR. State what the code does now, and move measurements to docs/.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (DATE.test(comment.value.replace(CODE_SPAN, ''))) {
            context.report({ loc: comment.loc, messageId: 'datedComment' });
          }
        }
      },
    };
  },
};
