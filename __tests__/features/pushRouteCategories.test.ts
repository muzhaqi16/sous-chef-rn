import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { STATIC_FEATURE_REGISTRY } from '#features/registry.static';

/**
 * `pushRoute.category` is a plain string on purpose — the enum is 118 runtime
 * objects and these manifests sit on the i18n launch path. This is where the
 * literal is checked against the schema instead: a category name the enum does
 * not carry routes nothing, and nothing else reports it.
 */
describe('every declared push route names a real notification category', () => {
  const categories: string[] = Object.values(NotificationCategory);

  const routes = STATIC_FEATURE_REGISTRY.filter(f => f.pushRoute).map(f => ({
    id: f.id,
    category: f.pushRoute!.category,
  }));

  it('finds the routes to check', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map(r => [r.id, r.category]))(
    '%s routes the %s category',
    (_id, category) => {
      expect(categories).toContain(category);
    },
  );

  it('gives each category at most one feature', () => {
    const used = routes.map(r => r.category);
    expect(new Set(used).size).toBe(used.length);
  });
});
