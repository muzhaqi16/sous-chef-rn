import { testTypedRule } from '#/test-utils/eslintRuleTester';

const PRELUDE = `import type {
  DeletionBlocker,
  LedgerPeriodData,
  ShoppingList,
  ShoppingListItemSource,
  UserEvent,
} from '#/graphql/generated/schemaTypes';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import type { UserEventsSubscription } from '#operations/auth/user.generated';
import type { CanDeleteAccountQuery } from '#operations/auth/user.generated';
import type { ErrorLike } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { FieldError } from 'react-hook-form';
declare const Text: (props: { children?: unknown }) => null;
declare const Banner: (props: { title?: string; message?: string }) => null;
declare const toastService: { error: (title: string, body?: string) => void };
declare const alertService: { alert: (title: string, body?: string) => void };
declare const t: (key: string, options?: Record<string, unknown>) => string;
declare const blocker: DeletionBlocker;
declare const result: CanDeleteAccountQuery;
declare const error: ErrorLike | undefined;
declare const combined: CombinedGraphQLErrors;
declare const fieldError: FieldError | undefined;
declare const local: Error;
declare const notification: UseNotificationsOnLaunch_NotificationFragment;
declare const userEvent: UserEvent;
declare const blockers: DeletionBlocker[];
declare const source: ShoppingListItemSource;
declare const period: LedgerPeriodData;
declare const list: ShoppingList;
declare const draft: { __typename: 'Notification'; title: string };
`;

const code = (body: string) => `${PRELUDE}${body}\n`;

const FOLLOW = [{ followProjections: true }];
const PROJECTED_ROWS =
  'const rows = [notification].map(n => ({ heading: n.title, id: n.id }));\n';

testTypedRule(
  'no-rendered-server-message',
  {
    valid: [
      // A react-hook-form error carries the local yup message.
      code('export const a = <Text>{fieldError?.message}</Text>;'),
      // An Error the app built itself is not the server's.
      code('export const a = <Text>{local.message}</Text>;'),
      // Read, but never rendered.
      code('export const logged = String(error?.message);'),
      code('console.warn(blocker.message);'),
      // Only the right side of `&&` renders.
      code(
        "export const a = <Text>{error?.message && t('errors.generic')}</Text>;",
      ),
      // A condition picks what renders; it is not rendered.
      code(
        "export const a = <Text>{blocker.message ? t('a') : t('b')}</Text>;",
      ),
      code(
        'export const a = <Text key={blocker.message}>{blocker.resourceName}</Text>;',
      ),
      // The typed fields build the copy.
      code(
        "export const a = <Text>{t('reason', { name: blocker.resourceName })}</Text>;",
      ),
      // A person typed a list's description; only listed server-copy fields report.
      code('export const a = <Text>{list.description}</Text>;'),
      // The same field name on a type the app declares is not the server's.
      code('export const a = <Text>{draft.title}</Text>;'),
      code('console.warn(userEvent.reason);'),
      code(
        "export const a = <Text>{notification.title ? t('a') : t('b')}</Text>;",
      ),
      // Without the option a projection is not followed.
      code(
        `${PROJECTED_ROWS}export const a = rows.map(r => <Text>{r.heading}</Text>);`,
      ),
      // Projected, but only logged or used as a key.
      {
        code: code(
          `${PROJECTED_ROWS}console.warn(rows[0]?.heading);\nexport const a = rows.map(r => <Text key={r.heading}>{r.id}</Text>);`,
        ),
        options: FOLLOW,
      },
      // The same property name on another object is not the projection.
      {
        code: code(
          `${PROJECTED_ROWS}const other = { heading: t('x') };\nconsole.warn(rows);\nexport const a = <Text>{other.heading}</Text>;`,
        ),
        options: FOLLOW,
      },
      // A projection built from localized copy.
      {
        code: code(
          "const rows = [notification].map(n => ({ heading: t('notifications.title', { name: n.id }) }));\nexport const a = rows.map(r => <Text>{r.heading}</Text>);",
        ),
        options: FOLLOW,
      },
      // An ADMIN wrote this title and message, so they are content, like a
      // list's name. The flag is the server's own say-so, and only the branch
      // it selects may read them.
      code(
        'export const a = notification.isAuthoredContent ? <Text>{notification.title}</Text> : null;',
      ),
      code(
        'export const a = <Text>{notification.isAuthoredContent && notification.message}</Text>;',
      ),
      code(
        'export function A() {\n  if (notification.isAuthoredContent) return <Text>{notification.title}</Text>;\n  return null;\n}',
      ),
      code(
        'export function A() {\n  if (!notification.isAuthoredContent) return null;\n  const { title } = notification;\n  return <Text>{title}</Text>;\n}',
      ),
    ],
    invalid: [
      {
        code: code('export const a = <Text>{blocker.message}</Text>;'),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          'export const a = blockers.map(b => <Text>{b.message}</Text>);',
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          "export const a = <Text>{error?.message || t('account.deleteGenericError')}</Text>;",
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code('export const a = <Banner message={combined.message} />;'),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          'export const a = <Text>{`Failed: ${error?.message ?? ""}`}</Text>;',
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code("toastService.error(t('labels.error'), error?.message);"),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          "alertService.alert(t('labels.error'), t('failed', { error: combined.message }));",
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          'const shown = blocker.message.trim();\nexport const a = <Text>{shown}</Text>;',
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code(
          'const { message } = blocker;\nexport const a = <Text>{message}</Text>;',
        ),
        errors: ['renderedServerMessage'],
      },
      {
        code: code('export const a = <Text>{notification.title}</Text>;'),
        errors: ['renderedServerCopy'],
      },
      // The ELSE arm of the authored test is the templated row, whose title is
      // the English this rule exists to keep off the screen.
      {
        code: code(
          'export const a = notification.isAuthoredContent ? null : <Text>{notification.title}</Text>;',
        ),
        errors: ['renderedServerCopy'],
      },
      // A flag of another name establishes nothing.
      {
        code: code(
          'export const a = notification.id ? <Text>{notification.title}</Text> : null;',
        ),
        errors: ['renderedServerCopy'],
      },
      // The exemption covers title and message only.
      {
        code: code(
          'export const a = notification.isAuthoredContent ? <Text>{userEvent.reason}</Text> : null;',
        ),
        errors: ['renderedServerCopy'],
      },
      {
        code: code(
          "toastService.error(userEvent.reason || t('accountEvents.warningReceived'));",
        ),
        errors: ['renderedServerCopy'],
      },
      {
        code: code(
          'const { autoAddReason } = source;\nexport const a = <Text>{autoAddReason}</Text>;',
        ),
        errors: ['renderedServerCopy'],
      },
      {
        code: code(
          "export const a = <Text>{t('period', { label: period.periodLabel })}</Text>;",
        ),
        errors: ['renderedServerCopy'],
      },
      {
        code: code(
          `${PROJECTED_ROWS}export const a = rows.map(r => <Text>{r.heading}</Text>);`,
        ),
        options: FOLLOW,
        errors: ['renderedServerCopyProjected'],
      },
      {
        code: code(
          'interface Row { body: string }\nfunction project(b: DeletionBlocker): Row { return { body: b.message ?? "" }; }\ndeclare const row: Row;\nexport const a = <Banner message={row.body} />;\nexport const rows = [blocker].map(project);',
        ),
        options: FOLLOW,
        errors: ['renderedServerMessageProjected'],
      },
      {
        code: code(
          'const toRow = (e: typeof userEvent) => ({ why: e.reason });\nexport const Row = ({ why }: ReturnType<typeof toRow>) => <Text>{why}</Text>;',
        ),
        options: FOLLOW,
        errors: ['renderedServerCopyProjected'],
      },
    ],
  },
  'tsx',
);
