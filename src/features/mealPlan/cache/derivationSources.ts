/**
 * What a plan copy, a template cut from a plan, or a plan laid from a template
 * reads out of the cache: the parent with EVERY one of its meals. A parent
 * whose later pages are still unread is not a source — deriving from a first
 * page would silently drop the rest.
 */
import type { ApolloCache } from '@apollo/client';
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

/** The cached plan with all its meals, or null when it is absent or partial. */
export function readPlanSource(
  cache: ApolloCache,
  mealPlanId: string,
): PlanSource | null {
  const id = cache.identify({ __typename: 'MealPlan', id: mealPlanId });
  if (!id) return null;
  const plan = cache.readFragment<UseDuplicateMealPlan_MealPlanFragment>({
    id,
    fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
    fragmentName: 'useDuplicateMealPlan_mealPlan',
  });
  if (!plan || plan.mealPlanItemsConnection.pageInfo.hasNextPage) return null;
  const { mealPlanItemsConnection, ...fields } = plan;
  return {
    ...fields,
    mealPlanItems: mealPlanItemsConnection.edges.map(edge => edge.node),
  };
}

/** The cached template with all its meals, or null when absent or partial. */
export function readTemplateSource(
  cache: ApolloCache,
  templateId: string,
): TemplateSource | null {
  const id = cache.identify({ __typename: 'MealTemplate', id: templateId });
  if (!id) return null;
  const template = cache.readFragment<UseMealTemplateActions_TemplateFragment>({
    id,
    fragment: UseMealTemplateActions_TemplateFragmentDoc,
    fragmentName: 'useMealTemplateActions_template',
  });
  if (!template || template.itemsConnection.pageInfo.hasNextPage) return null;
  const { itemsConnection, ...fields } = template;
  return { ...fields, items: itemsConnection.edges.map(edge => edge.node) };
}
