import type * as Types from '../../graphql/generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type EditCustomMealSheet_ItemFragment = {
  __typename: 'MealPlanItem';
  id: string;
  mealType: Types.MealType;
  customMealName: string | null;
  notes: string | null;
};

export const EditCustomMealSheet_ItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'EditCustomMealSheet_item' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<EditCustomMealSheet_ItemFragment, unknown>;
