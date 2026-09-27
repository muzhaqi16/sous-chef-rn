import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { initialMoveTarget, moveTargets } from '../moveTargets';

const home = (
  id: string,
  role: MembershipRole,
  canAddItems: boolean,
  pantries: Array<{ id: string; isDefault: boolean }>,
) => ({
  id,
  name: `Home ${id}`,
  myMembership: { role, canAddItems },
  pantriesConnection: {
    edges: pantries.map(p => ({ node: { ...p, name: `Pantry ${p.id}` } })),
  },
});

describe('moveTargets', () => {
  const homes = [
    home('a', MembershipRole.Member, true, [
      { id: 'a1', isDefault: true },
      { id: 'a2', isDefault: false },
    ]),
    home('b', MembershipRole.Owner, false, [{ id: 'b1', isDefault: true }]),
  ];

  it("offers only the selected home's pantries", () => {
    const targets = moveTargets(homes, 'a');

    expect(
      targets.status === 'ready' && targets.pantries.map(p => p.id),
    ).toEqual(['a1', 'a2']);
  });

  it('lets an owner or admin add without the canAddItems flag', () => {
    expect(moveTargets(homes, 'b').status).toBe('ready');
  });

  it('names the home when the caller cannot add to it', () => {
    const guestHome = [
      home('g', MembershipRole.Guest, false, [{ id: 'g1', isDefault: true }]),
    ];

    expect(moveTargets(guestHome, 'g')).toEqual({
      status: 'notAllowed',
      homeName: 'Home g',
    });
  });

  it('reports a home with no pantry, or no home selected', () => {
    const empty = [home('e', MembershipRole.Owner, true, [])];

    expect(moveTargets(empty, 'e')).toEqual({ status: 'noPantry' });
    expect(moveTargets(homes, null)).toEqual({ status: 'noPantry' });
  });
});

describe('initialMoveTarget', () => {
  const pantries = [
    { id: 'x', name: 'x', isDefault: false },
    { id: 'd', name: 'd', isDefault: true },
  ];

  it('picks the pantry the app is on, then the default, then the first', () => {
    expect(initialMoveTarget(pantries, 'x')).toBe('x');
    expect(initialMoveTarget(pantries, 'gone')).toBe('d');
    expect(
      initialMoveTarget([{ id: 'only', name: 'o', isDefault: false }], null),
    ).toBe('only');
    expect(initialMoveTarget([], 'gone')).toBeNull();
  });
});
