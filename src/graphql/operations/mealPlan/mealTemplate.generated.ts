import type * as Types from '../../generated/schemaTypes';

import type {
  MealTemplateDisplayFragment,
  MealTemplateItemFragment,
  MealPlanFullFragment,
} from './mealPlanFragments.generated';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type GetMealTemplatesQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.MealTemplateFilters>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  orderBy?: Types.InputMaybe<Types.MealTemplateOrderBy>;
}>;

export type GetMealTemplatesQuery = {
  __typename: 'Query';
  mealTemplates: {
    __typename: 'MealTemplateConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'MealTemplateEdge';
      cursor: string;
      node: { __typename: 'MealTemplate' } & MealTemplateDisplayFragment;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type GetMealTemplateQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetMealTemplateQuery = {
  __typename: 'Query';
  mealTemplate:
    | ({
        __typename: 'MealTemplate';
        items: Array<
          { __typename: 'MealTemplateItem' } & MealTemplateItemFragment
        >;
      } & MealTemplateDisplayFragment)
    | null;
};

export type DeleteMealTemplateMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeleteMealTemplateMutation = {
  __typename: 'Mutation';
  deleteMealTemplate: {
    __typename: 'MealTemplatePayload';
    success: boolean;
    message: string;
    code: string;
    mealTemplate: {
      __typename: 'MealTemplate';
      id: string;
      name: string;
    } | null;
  };
};

export type DuplicateTemplateMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  newName: Types.Scalars['String']['input'];
}>;

export type DuplicateTemplateMutation = {
  __typename: 'Mutation';
  duplicateTemplate: {
    __typename: 'MealTemplatePayload';
    success: boolean;
    message: string;
    code: string;
    mealTemplate:
      | ({
          __typename: 'MealTemplate';
          items: Array<
            { __typename: 'MealTemplateItem' } & MealTemplateItemFragment
          >;
        } & MealTemplateDisplayFragment)
      | null;
  };
};

export type CreateMealPlanFromTemplateMutationVariables = Types.Exact<{
  input: Types.CreateMealPlanFromTemplateInput;
}>;

export type CreateMealPlanFromTemplateMutation = {
  __typename: 'Mutation';
  createMealPlanFromTemplate: {
    __typename: 'MealPlanPayload';
    success: boolean;
    message: string;
    code: string;
    mealPlan: ({ __typename: 'MealPlan' } & MealPlanFullFragment) | null;
  };
};

export type CreateTemplateFromMealPlanMutationVariables = Types.Exact<{
  input: Types.CreateTemplateFromMealPlanInput;
}>;

export type CreateTemplateFromMealPlanMutation = {
  __typename: 'Mutation';
  createTemplateFromMealPlan: {
    __typename: 'MealTemplatePayload';
    success: boolean;
    message: string;
    code: string;
    mealTemplate:
      | ({
          __typename: 'MealTemplate';
          items: Array<
            { __typename: 'MealTemplateItem' } & MealTemplateItemFragment
          >;
        } & MealTemplateDisplayFragment)
      | null;
  };
};

export const GetMealTemplatesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetMealTemplates' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'filters' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'MealTemplateFilters' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'orderBy' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'MealTemplateOrderBy' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'mealTemplates' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filters' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'filters' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'orderBy' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'orderBy' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'MealTemplateDisplay',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cursor' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pageInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasNextPage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'endCursor' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplate' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'durationDays' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultServings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  GetMealTemplatesQuery,
  GetMealTemplatesQueryVariables
>;
export const GetMealTemplateDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetMealTemplate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'mealTemplate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealTemplateDisplay' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'MealTemplateItemFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplate' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'durationDays' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultServings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplateItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dayOffset' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
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
} as unknown as DocumentNode<
  GetMealTemplateQuery,
  GetMealTemplateQueryVariables
>;
export const DeleteMealTemplateDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteMealTemplate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteMealTemplate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealTemplate' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteMealTemplateMutation,
  DeleteMealTemplateMutationVariables
>;
export const DuplicateTemplateDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DuplicateTemplate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'newName' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'duplicateTemplate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'newName' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'newName' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealTemplate' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MealTemplateDisplay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'items' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'MealTemplateItemFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplate' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'durationDays' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultServings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplateItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dayOffset' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
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
} as unknown as DocumentNode<
  DuplicateTemplateMutation,
  DuplicateTemplateMutationVariables
>;
export const CreateMealPlanFromTemplateDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateMealPlanFromTemplate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateMealPlanFromTemplateInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createMealPlanFromTemplate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealPlan' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MealPlanFull' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlan' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'planType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'startDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'endDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCalories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalProtein' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCarbs' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalFat' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actualCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'budgetAmount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createdBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
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
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanMain_item' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanItemActions_item' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCompleted' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanFull' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlan' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'MealPlanDisplay' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dietaryProfile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'calorieTarget' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'proteinTarget' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'carbsTarget' } },
                { kind: 'Field', name: { kind: 'Name', value: 'fatTarget' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'mealPlanItems' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanItemCard_item' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'EditCustomMealSheet_item' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'DailyMeals_item' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanMain_item' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanItemActions_item' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'generatedShoppingLists' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'nutritionSummary' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalCalories' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalProtein' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCarbs' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalFat' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyCalories' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyProtein' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyCarbs' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'avgDailyFat' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalMeals' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealsWithNutrition' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'coveragePercentage' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealTypeBreakdown' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealType' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCalories' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalProtein' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCarbs' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalFat' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealCount' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'nutritionGoalProgress' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'overallScore' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'caloriesProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'proteinProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'carbsProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fatProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateMealPlanFromTemplateMutation,
  CreateMealPlanFromTemplateMutationVariables
>;
export const CreateTemplateFromMealPlanDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateTemplateFromMealPlan' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateTemplateFromMealPlanInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createTemplateFromMealPlan' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealTemplate' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MealTemplateDisplay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'items' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'MealTemplateItemFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplate' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'durationDays' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultServings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplateItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dayOffset' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
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
} as unknown as DocumentNode<
  CreateTemplateFromMealPlanMutation,
  CreateTemplateFromMealPlanMutationVariables
>;
