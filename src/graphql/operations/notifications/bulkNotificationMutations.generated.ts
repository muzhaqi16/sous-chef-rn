import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type MarkAllNotificationsAsReadMutationVariables = Types.Exact<{ [key: string]: never; }>;


export type MarkAllNotificationsAsReadMutation = { __typename: 'Mutation', markAllNotificationsAsRead: { __typename: 'BulkNotificationPayload', success: boolean, message: string, code: string, count: number } };


export const MarkAllNotificationsAsReadDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkAllNotificationsAsRead"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markAllNotificationsAsRead"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<MarkAllNotificationsAsReadMutation, MarkAllNotificationsAsReadMutationVariables>;