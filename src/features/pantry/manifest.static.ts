import type { StaticFeatureManifest } from '#features/staticTypes';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import en from './locales/en.json';
import es from './locales/es.json';
import it from './locales/it.json';
import sq from './locales/sq.json';

export const pantryStaticFeature: StaticFeatureManifest = {
  id: 'pantry',
  locales: { en, es, it, sq },
  pushRoute: {
    category: NotificationCategory.Pantry,
    tab: 'Pantry',
    screen: 'PantryMain',
  },
};
