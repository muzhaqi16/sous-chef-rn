/**
 * What a plan copy, a template cut from a plan, or a plan laid from a template
 * reads out of the cache: the parent with EVERY one of its meals. A parent
 * whose later pages are still unread is not a source — deriving from a first
 * page would silently drop the rest.
 */
import type { ApolloCache, TypedDocumentNode } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import {
  UseDuplicateMealPlan_MealPlanFragmentDoc,
  type UseDuplicateMealPlan_MealPlanFragment,
} from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
import {
  UseMealTemplateActions_TemplateFragmentDoc,
  type UseMealTemplateActions_TemplateFragment,
} from '#features/mealPlan/hooks/useMealTemplateActions.generated';

type PlanMeal =
  UseDuplicateMealPlan_MealPlanFragment['mealPlanItemsConnection']['edges'][number]['node'];
type TemplateMeal =
  UseMealTemplateActions_TemplateFragment['itemsConnection']['edges'][number]['node'];

export type PlanSource = Omit<
  UseDuplicateMealPlan_MealPlanFragment,
  'mealPlanItemsConnection'
> & { mealPlanItems: PlanMeal[] };

export type TemplateSource = Omit<
  UseMealTemplateActions_TemplateFragment,
  'itemsConnection'
> & { items: TemplateMeal[] };

/** The cached parent with all its meals, or null when it is absent or partial. */
function readWhole<TParent, TMeal>(
  cache: ApolloCache,
  from: { __typename: 'MealPlan' | 'MealTemplate'; id: string },
  fragment: TypedDocumentNode<TParent, unknown>,
  fragmentName: string,
  mealsOf: (parent: Unmasked<TParent>) => {
    pageInfo: { hasNextPage: boolean };
    edges: ReadonlyArray<{ node: TMeal }>;
  },
): { parent: Unmasked<TParent>; meals: TMeal[] } | null {
  const parent = cache.readFragment({ from, fragment, fragmentName });
  if (!parent) return null;
  const { pageInfo, edges } = mealsOf(parent);
  if (pageInfo.hasNextPage) return null;
  return { parent, meals: edges.map(edge => edge.node) };
}

export function readPlanSource(
  cache: ApolloCache,
  mealPlanId: string,
): PlanSource | null {
  const whole = readWhole(
    cache,
    { __typename: 'MealPlan', id: mealPlanId },
    UseDuplicateMealPlan_MealPlanFragmentDoc,
    'useDuplicateMealPlan_mealPlan',
    plan => plan.mealPlanItemsConnection,
  );
  if (!whole) return null;
  const { mealPlanItemsConnection, ...fields } = whole.parent;
  return { ...fields, mealPlanItems: whole.meals };
}

export function readTemplateSource(
  cache: ApolloCache,
  templateId: string,
): TemplateSource | null {
  const whole = readWhole(
    cache,
    { __typename: 'MealTemplate', id: templateId },
    UseMealTemplateActions_TemplateFragmentDoc,
    'useMealTemplateActions_template',
    template => template.itemsConnection,
  );
  if (!whole) return null;
  const { itemsConnection, ...fields } = whole.parent;
  return { ...fields, items: whole.meals };
}
