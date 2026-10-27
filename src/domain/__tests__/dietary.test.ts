import { Diet, HealthGoal, Intolerance } from '#/graphql/generated/schemaTypes';
import { restrictionLabelKey } from '../dietary';

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
