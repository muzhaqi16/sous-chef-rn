import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `declare const t: (key: string) => string;
declare const setError: (value: string) => void;
declare const logger: { warn: (...args: unknown[]) => void };
declare const errorService: { reportError: (e: unknown, c: object) => void };
declare const Field: (props: { errorMessage?: string; context?: string }) => null;
declare function string(): { required: (m: unknown) => unknown; matches: (r: RegExp, m: unknown) => unknown };
interface QueueError { message: string; code: string }
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

testTypedRule(
  'no-prose-literal',
  {
    valid: [
      code("export const option = { title: t('pantry.title') };"),
      // Identifiers and keys, not prose.
      code(
        "export const option = { labelKey: 'labels.addItem', title: 'pantry.title' };",
      ),
      code("export const placeholder = 'e.g.';"),
      code("export const message = 'https://example.com/help me';"),
      // Developer-facing.
      code(
        "logger.warn('Cache update failed', { message: 'Queue is full now' });",
      ),
      code(
        "errorService.reportError(new Error('x'), { hint: 'Retry later please' });",
      ),
      code("export const e = new Error('Something went wrong');"),
      code(
        "export class QuotaError extends Error { message = 'Quota exceeded today'; }",
      ),
      code("export const logLabel = 'Update Home Fields';"),
      code(
        "export const record: QueueError = { message: 'Queue is full now', code: 'FULL' };",
      ),
      // Not a copy name: `context` merely ends in "text".
      code('export const a = <Field context="Navigation - will recover" />;'),
      code("export function getErrorCategory() { return 'Unknown'; }"),
    ],
    invalid: [
      {
        code: code("export const option = { title: 'Delete item' };"),
        errors: ['prose'],
      },
      {
        code: code("export const emptyMessage = 'No items yet';"),
        errors: ['prose'],
      },
      {
        code: code("setError('Please enter a value');"),
        errors: ['prose'],
      },
      {
        code: code(
          "export const Row = ({ placeholder = 'Select date' }: { placeholder?: string }) => placeholder;",
        ),
        errors: ['prose'],
      },
      {
        code: code(
          "export function getStatusLabel(ok: boolean) { return ok ? 'Pending' : 'Accepted'; }",
        ),
        errors: ['prose', 'prose'],
      },
      {
        code: code(
          'export const formatDays = (days: number) => `${days} days in pantry`;',
        ),
        errors: ['prose'],
      },
      {
        code: code(
          'export const a = <Field errorMessage="Name is required" />;',
        ),
        errors: ['prose'],
      },
      {
        code: code(
          "export const rule = string().required('Name is required');",
        ),
        errors: ['prose'],
      },
    ],
  },
  'tsx',
);
