import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { t } from '#/i18n';
import {
  Diet,
  DietaryAlertState,
  Intolerance,
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { ProductDietaryAlertsDocument } from '../useProductDietaryAlerts.generated';
import { useProductDietaryAlerts } from '../useProductDietaryAlerts';

let mockHomeId: string | null = 'home-1';
jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => mockHomeId,
  useUser: () => ({ id: 'u-me' }),
}));
let mockOffline = false;
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockOffline,
}));
let mockRestrictionsInPlay: boolean | null = true;
jest.mock('#features/profile/hooks/useRestrictionsInPlay', () => ({
  useRestrictionsInPlay: () => mockRestrictionsInPlay,
}));

const restriction = (
  id: string,
  kind: { diet?: Diet; intolerance?: Intolerance },
  severity: RestrictionSeverity,
) => ({
  id,
  diet: kind.diet ?? null,
  intolerance: kind.intolerance ?? null,
  healthGoal: null,
  item: null,
  severity,
});

const alertsMock = () =>
  recordMock(ProductDietaryAlertsDocument, {
    data: {
      item: {
        id: 'granola',
        dietaryAlerts: [
          {
            state: DietaryAlertState.Contains,
            membership: {
              id: 'm-tani',
              userId: 'u-tani',
              role: MembershipRole.Member,
              displayName: 'Tani',
            },
            restriction: restriction(
              'r-peanut',
              { intolerance: Intolerance.Peanut },
              RestrictionSeverity.Allergy,
            ),
          },
          {
            state: DietaryAlertState.MayContain,
            membership: {
              id: 'm-me',
              userId: 'u-me',
              role: MembershipRole.Owner,
              displayName: 'John',
            },
            restriction: restriction(
              'r-vegan',
              { diet: Diet.Vegan },
              RestrictionSeverity.Preference,
            ),
          },
        ],
        dietaryAlternatives: [
          {
            id: 'oat-granola',
            name: 'Oat Granola',
            imageUrl: null,
            primaryUpc: '012345678905',
          },
        ],
      },
    },
  });

const noAlertsMock = () =>
  recordMock(ProductDietaryAlertsDocument, {
    data: {
      item: { id: 'granola', dietaryAlerts: [], dietaryAlternatives: [] },
    },
  });

beforeEach(() => {
  mockHomeId = 'home-1';
  mockOffline = false;
  mockRestrictionsInPlay = true;
});

describe('useProductDietaryAlerts', () => {
  it('words each alert from its restriction, the user as You', async () => {
    const { result } = renderHookWithApollo(
      () => useProductDietaryAlerts('granola'),
      { operationMocks: [alertsMock().mock] },
    );

    await waitFor(() => expect(result.current.check).toBe('checked'));
    expect(result.current.alerts).toEqual([
      {
        id: 'r-peanut',
        memberName: 'Tani',
        what: t('recipes.intolerance.PEANUT'),
        state: DietaryAlertState.Contains,
        severity: RestrictionSeverity.Allergy,
        isDiet: false,
      },
      {
        id: 'r-vegan',
        memberName: t('homeDetail.youLabel'),
        what: t('labels.vegan'),
        state: DietaryAlertState.MayContain,
        severity: RestrictionSeverity.Preference,
        isDiet: true,
      },
    ]);
    expect(result.current.alternatives).toEqual([
      {
        id: 'oat-granola',
        name: 'Oat Granola',
        imageUrl: null,
        primaryUpc: '012345678905',
      },
    ]);
  });

  it('marks an earlier answer as possibly out of date once offline', async () => {
    const { result, rerender } = renderHookWithApollo(
      () => useProductDietaryAlerts('granola'),
      { operationMocks: [alertsMock().mock] },
    );
    await waitFor(() => expect(result.current.check).toBe('checked'));

    mockOffline = true;
    rerender({});

    expect(result.current.check).toBe('stale');
    expect(result.current.alerts).toHaveLength(2);
  });

  it('says it could not check, never "nothing found", offline with no answer', () => {
    mockOffline = true;
    const { result } = renderHookWithApollo(
      () => useProductDietaryAlerts('granola'),
      { operationMocks: [] },
    );

    expect(result.current.check).toBe('unchecked');
    expect(result.current.alerts).toEqual([]);
  });

  it('says the check failed, not that it needs a connection, online', async () => {
    const { result } = renderHookWithApollo(
      () => useProductDietaryAlerts('granola'),
      {
        operationMocks: [
          recordMock(ProductDietaryAlertsDocument, {
            error: new Error('boom'),
          }).mock,
        ],
      },
    );

    await waitFor(() => expect(result.current.check).toBe('failed'));
    expect(result.current.alerts).toEqual([]);
  });

  it('checks nothing without a home', () => {
    mockHomeId = null;
    const { result } = renderHookWithApollo(
      () => useProductDietaryAlerts('granola'),
      { operationMocks: [] },
    );

    expect(result.current.check).toBe('none');
  });

  describe('the label caveat', () => {
    const answeredWith = async (
      mock: ReturnType<typeof recordMock>,
      inPlay: boolean | null,
    ) => {
      mockRestrictionsInPlay = inPlay;
      const rendered = renderHookWithApollo(
        () => useProductDietaryAlerts('granola'),
        { operationMocks: [mock.mock] },
      );
      await waitFor(() => expect(rendered.result.current.check).toBe('checked'));
      return rendered.result.current;
    };

    it('shows beside an alert', async () => {
      expect((await answeredWith(alertsMock(), false)).caveat).toBe(true);
    });

    it('shows for a product that matched nothing while a restriction is in play', async () => {
      expect((await answeredWith(noAlertsMock(), true)).caveat).toBe(true);
    });

    it('shows while it is not yet known whether a restriction is in play', async () => {
      expect((await answeredWith(noAlertsMock(), null)).caveat).toBe(true);
    });

    it('is absent when no restriction anywhere can alert', async () => {
      expect((await answeredWith(noAlertsMock(), false)).caveat).toBe(false);
    });

    it('is absent while the check is unchecked, failed or loading', async () => {
      mockOffline = true;
      const offline = renderHookWithApollo(
        () => useProductDietaryAlerts('granola'),
        { operationMocks: [] },
      );
      expect(offline.result.current.caveat).toBe(false);

      mockOffline = false;
      const failing = renderHookWithApollo(
        () => useProductDietaryAlerts('granola'),
        {
          operationMocks: [
            recordMock(ProductDietaryAlertsDocument, {
              error: new Error('boom'),
            }).mock,
          ],
        },
      );
      expect(failing.result.current.check).toBe('loading');
      expect(failing.result.current.caveat).toBe(false);
      await waitFor(() => expect(failing.result.current.check).toBe('failed'));
      expect(failing.result.current.caveat).toBe(false);
    });
  });
});
