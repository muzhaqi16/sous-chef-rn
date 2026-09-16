import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `declare const t: (key: string) => string;
declare const setError: (value: string) => void;
declare const logger: { warn: (...args: unknown[]) => void };
declare const errorService: { reportError: (e: unknown, c: object) => void };
declare const Field: (props: { errorMessage?: string; context?: string }) => null;
declare function string(): { required: (m: unknown) => unknown; matches: (r: RegExp, m: unknown) => unknown };
interface QueueError { message: string; code: string }
declare function useState<T>(initial: T): [T, (value: T) => void];
declare const Text: (props: { children?: unknown }) => null;
declare const Button: (props: { title?: string; mode?: string }) => null;
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

const FOLLOW = [{ followRendered: true }];

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
      // Without the option, rendered state and returns are not followed.
      code(
        "export function A() { const [status, setStatus] = useState('Waiting for sync'); return <Text>{status}</Text>; }",
      ),
      // State that is compared or passed as a non-copy prop is not rendered.
      {
        code: code(
          "export function B() { const [mode, setMode] = useState('Edit'); setMode('View'); return <Button mode={mode} title={mode === 'Edit' ? t('a') : t('b')} />; }",
        ),
        options: FOLLOW,
      },
      // A guard on the left of `&&` is not rendered.
      {
        code: code(
          "export function C() { const [phase, setPhase] = useState('Not started'); return <Text>{phase && t('a')}</Text>; }",
        ),
        options: FOLLOW,
      },
      // Rendered state written with translated copy.
      {
        code: code(
          "export function D() { const [status, setStatus] = useState(''); setStatus(t('sync.waiting')); return <Text>{status}</Text>; }",
        ),
        options: FOLLOW,
      },
      // A function whose result is only logged is developer-facing.
      {
        code: code(
          "function describe() { return 'Queue drained fully'; }\nlogger.warn(describe());\nexport const a = <Text>{t('a')}</Text>;",
        ),
        options: FOLLOW,
      },
      // A rendered return of a thrown message.
      {
        code: code(
          "function pick(ok: boolean) { if (!ok) throw new Error('Unexpected state here'); return t('a'); }\nexport const a = <Text>{pick(true)}</Text>;",
        ),
        options: FOLLOW,
      },
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
      {
        code: code(
          "export function A() { const [status, setStatus] = useState('Waiting for sync'); return <Text>{status}</Text>; }",
        ),
        options: FOLLOW,
        errors: ['prose'],
      },
      {
        code: code(
          "export function B() { const [status, setStatus] = useState(''); setStatus(failed ? 'Sync failed' : t('ok')); return <Button title={`${status}`} />; }",
        ),
        options: FOLLOW,
        errors: ['prose'],
      },
      {
        code: code(
          "function statusOf(ok: boolean) { return ok ? 'Up to date' : 'Pending'; }\nexport const a = <Text>{statusOf(true)}</Text>;",
        ),
        options: FOLLOW,
        errors: ['prose', 'prose'],
      },
      {
        code: code(
          'const heading = (n: number) => `${n} items left`;\nexport const a = <Button title={heading(2)} />;',
        ),
        options: FOLLOW,
        errors: ['prose'],
      },
    ],
  },
  'tsx',
);
