import type * as Types from '../../graphql/generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type DailyMeals_ItemFragment = {
  __typename: 'MealPlanItem';
  id: string;
  date: string;
  mealType: Types.MealType;
  calories: number | null;
  customMealName: string | null;
  recipe: { __typename: 'Recipe'; name: string } | null;
};

export const DailyMeals_ItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'DailyMeals_item' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'date' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'calories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DailyMeals_ItemFragment, unknown>;
