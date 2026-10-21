/**
 * What a credit or notice shows, as plain data: the store, the core hooks and
 * the components that render them all name these without importing a component.
 */
import type {
  DataAttribution,
  ImageCredit,
} from '#/graphql/generated/schemaTypes';

/** A licensed photo's attribution. */
export type PhotoCreditValue = Pick<
  ImageCredit,
  'text' | 'license' | 'licenseUrl' | 'sourceUrl'
>;

/** A data provider's notice, such as a recipe provider's backlink. */
export type DataAttributionValue = Pick<
  DataAttribution,
  'source' | 'notice' | 'licenseUrl' | 'sourceUrl'
>;
