import { Diet, HealthGoal, Intolerance } from '#/graphql/generated/schemaTypes';
import {
  INTOLERANCE_OPTIONS,
  INTOLERANCE_OPTIONS_MAJOR_FIRST,
  canAlert,
  householdCheckOf,
  restrictionLabelKey,
} from '../dietary';

describe('INTOLERANCE_OPTIONS_MAJOR_FIRST', () => {
  it('leads with the nine major US allergens, in order', () => {
    expect(
      INTOLERANCE_OPTIONS_MAJOR_FIRST.slice(0, 9).map(option => option.value),
    ).toEqual([
      Intolerance.Dairy,
      Intolerance.Egg,
      Intolerance.Fish,
      Intolerance.Shellfish,
      Intolerance.TreeNut,
      Intolerance.Peanut,
      Intolerance.Wheat,
      Intolerance.Soy,
      Intolerance.Sesame,
    ]);
  });

  it('lists every option exactly once', () => {
    const values = INTOLERANCE_OPTIONS_MAJOR_FIRST.map(option => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual(
      INTOLERANCE_OPTIONS.map(option => option.value).sort(),
    );
  });
});

describe('canAlert', () => {
  it('lets a diet, an intolerance and an avoided item alert', () => {
    expect(canAlert({ diet: Diet.Vegan })).toBe(true);
    expect(canAlert({ intolerance: Intolerance.Peanut })).toBe(true);
    expect(canAlert({ item: { id: 'bacon' } })).toBe(true);
  });

  it('never lets a health goal alert', () => {
    const lowCarb = {
      diet: null,
      intolerance: null,
      healthGoal: HealthGoal.LowCarb,
      item: null,
    };
    expect(canAlert(lowCarb)).toBe(false);
  });
});

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
