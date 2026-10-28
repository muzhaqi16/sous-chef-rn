import { Diet, HealthGoal, Intolerance } from '#/graphql/generated/schemaTypes';
import { householdCheckOf, restrictionLabelKey } from '../dietary';

describe('restrictionLabelKey', () => {
  it('names a diet, an intolerance and a health goal', () => {
    expect(restrictionLabelKey({ diet: Diet.Vegan })).toBe('labels.vegan');
    expect(restrictionLabelKey({ intolerance: Intolerance.Peanut })).toBe(
      'recipes.intolerance.PEANUT',
    );
    expect(restrictionLabelKey({ healthGoal: HealthGoal.LowCarb })).toBe(
      'recipes.healthGoal.LOW_CARB',
    );
  });

  it('reads a value this build does not list as unknown, never raw', () => {
    expect(restrictionLabelKey({ diet: 'CARNIVORE' as unknown as Diet })).toBe(
      'labels.unknown',
    );
    expect(restrictionLabelKey({})).toBe('labels.unknown');
  });
});

describe('householdCheckOf', () => {
  const at = (state: Partial<Parameters<typeof householdCheckOf>[0]>) =>
    householdCheckOf({
      hasHome: true,
      answered: false,
      offline: false,
      failed: false,
      loading: false,
      ...state,
    });

  it('calls an earlier answer stale once its refresh failed, as offline', () => {
    expect(at({ answered: true, failed: true })).toBe('stale');
    expect(at({ answered: true, offline: true })).toBe('stale');
  });

  it('calls an answer whose refresh did not fail checked', () => {
    expect(at({ answered: true })).toBe('checked');
    expect(at({ answered: true, loading: true })).toBe('checked');
  });

  it('never reads a failure with no answer as "nothing found"', () => {
    expect(at({ failed: true })).toBe('failed');
    expect(at({ offline: true })).toBe('unchecked');
  });

  it('checks nothing without a home', () => {
    expect(at({ hasHome: false, answered: true, failed: true })).toBe('none');
  });
});
