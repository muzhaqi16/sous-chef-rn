import type * as Types from '../../graphql/generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type MealPlanItemCard_ItemFragment = {
  __typename: 'MealPlanItem';
  id: string;
  isCompleted: boolean;
  customMealName: string | null;
  servings: number | null;
  calories: number | null;
  usedPantryItems: any;
  recipe: {
    __typename: 'Recipe';
    id: string;
    name: string;
    imageUrl: string | null;
    totalTimeMinutes: number | null;
  } | null;
};

export const MealPlanItemCard_ItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanItemCard_item' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCompleted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'calories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usedPantryItems' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalTimeMinutes' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MealPlanItemCard_ItemFragment, unknown>;
