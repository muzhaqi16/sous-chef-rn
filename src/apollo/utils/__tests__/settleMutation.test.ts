import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { alertService, type AlertButton } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { storeApi } from '#store';
import { t } from '#/i18n';
import {
  ErrorCode,
  TopLevelErrorCode,
  UnitDenial,
} from '#/graphql/generated/schemaTypes';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import {
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryItemDocument,
  type CreatePantryItemMutation,
  type CreatePantryItemUsageMutation,
  type DeletePantryItemMutation,
} from '#features/pantry/graphql/pantry.generated';
import { operationNameOf } from '../documentOperation';
import { settleMutation, settledStatus } from '../settleMutation';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { Telemetry } from '#/services/telemetry';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// A payload member, its typename checked against the operation's result union.
type Member<T extends { __typename: string }> = {
  __typename: T['__typename'];
  code?: string;
  field?: string | null;
  resource?: string | null;
  validUnits?: string[];
  denial?: UnitDenial | null;
  available?: number | null;
  availableUnitSymbol?: string | null;
};
type Create = CreatePantryItemMutation['createPantryItem'];
type Use = CreatePantryItemUsageMutation['createPantryItemUsage'];
type Delete = DeletePantryItemMutation['deletePantryItem'];

const create = (member: Member<Create> | null) => () =>
  Promise.resolve({ data: { createPantryItem: member } });
const use = (member: Member<Use>) => () =>
  Promise.resolve({ data: { createPantryItemUsage: member } });
const remove = (member: Member<Delete>) => () =>
  Promise.resolve({ data: { deletePantryItem: member } });
const throwing = (error: unknown) => () => Promise.reject(error);

const FALLBACK = 'Could not save the item.';
const SERVER_TEXT = 'raw server English';
const options = { document: CreatePantryItemDocument, fallback: FALLBACK };
const alerts = () => (alertService.alert as jest.Mock).mock.calls;
const graphQLError = (code: string) =>
  new CombinedGraphQLErrors({
    errors: [{ message: SERVER_TEXT, extensions: { code } }],
  });

let reportError: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  reportError = jest
    .spyOn(errorService, 'reportError')
    .mockImplementation(() => undefined);
});
afterEach(() => reportError.mockRestore());

describe('settleMutation', () => {
  it('settles an applied write as applied, with nothing to say', async () => {
    const onFailed = jest.fn();
    const settled = await settleMutation(
      create({ __typename: 'CreatePantryItemPayload' }),
      { ...options, onFailed },
    );

    expect(settled.status).toBe('applied');
    expect(onFailed).not.toHaveBeenCalled();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('settles a queued write as queued, leaving the local change standing', async () => {
    const onFailed = jest.fn();
    const settled = await settleMutation(create(null), {
      ...options,
      onFailed,
    });

    expect(settled.status).toBe('queued');
    expect(onFailed).not.toHaveBeenCalled();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('counts a replay the server already committed as applied', async () => {
    const settled = await settleMutation(
      create({ __typename: 'ConflictError', code: ErrorCode.IdempotentReplay }),
      options,
    );
    expect(settled.status).toBe('applied');
  });

  it('counts removing a row that is already gone as applied', async () => {
    const settled = await settleMutation(
      remove({ __typename: 'NotFoundError', code: ErrorCode.NotFound }),
      { document: DeletePantryItemDocument, fallback: FALLBACK, removal: true },
    );

    expect(settled.status).toBe('applied');
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('counts removing a row a thrown not-found says is already gone as applied', async () => {
    const settled = await settleMutation(
      throwing(graphQLError(TopLevelErrorCode.ResourceNotFound)),
      { document: DeletePantryItemDocument, fallback: FALLBACK, removal: true },
    );

    expect(settled.status).toBe('applied');
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('counts a refusal returned as data once, by operation and code, without reporting it as an error', async () => {
    await settleMutation(
      create({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
      }),
      options,
    );

    expect(Telemetry.increment).toHaveBeenCalledTimes(1);
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'mutation_refused_total',
      1,
      {
        operation: operationNameOf(CreatePantryItemDocument),
        code: ErrorCode.ValidationFailed,
      },
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a missing record as not found when the write is not a removal', async () => {
    const settled = await settleMutation(
      create({ __typename: 'NotFoundError', code: ErrorCode.NotFound }),
      options,
    );

    expect(settled.status).toBe('failed');
    expect(alerts()).toEqual([[t('errors.notFoundTitle'), expect.any(String)]]);
  });

  describe('a refusal', () => {
    it("undoes the local change and shows the field's copy, never the server's", async () => {
      const onFailed = jest.fn();
      const settled = await settleMutation(
        create({
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'input.quantity',
        }),
        { ...options, onFailed },
      );

      expect(settled.status).toBe('failed');
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(alerts()).toEqual([
        [
          t('labels.error'),
          t('errors.field.quantity', { defaultValue: FALLBACK }),
        ],
      ]);
    });

    it("shows the code's own copy when it says more than the field does", async () => {
      // Over-consuming reports INSUFFICIENT_QUANTITY on the quantity field. The
      // number the user typed is a valid one, so the field's "that quantity
      // isn't valid" is the wrong sentence; the pantry simply holds less.
      const settled = await settleMutation(
        create({
          __typename: 'ValidationError',
          code: ErrorCode.InsufficientQuantity,
          field: 'input.quantity',
        }),
        options,
      );

      expect(settled.status).toBe('failed');
      expect(alerts()).toEqual([
        [t('labels.error'), t('errors.codes.insufficientQuantity')],
      ]);
    });

    it("falls back to the caller's copy when nothing more specific applies", async () => {
      await settleMutation(create({ __typename: 'ForbiddenError' }), options);
      expect(alerts()).toEqual([[t('labels.error'), FALLBACK]]);
    });

    it("runs the caller's handler for its code alongside the message", async () => {
      const onUnitInvalid = jest.fn();
      await settleMutation(
        create({
          __typename: 'ValidationError',
          code: TopLevelErrorCode.UnitInvalid,
        }),
        { ...options, on: { [TopLevelErrorCode.UnitInvalid]: onUnitInvalid } },
      );

      expect(onUnitInvalid).toHaveBeenCalledTimes(1);
      expect(alerts()).toEqual([
        [t('errors.invalidUnitTitle'), t('errors.codes.unitInvalid')],
      ]);
    });
  });

  describe('a stock refusal', () => {
    it('says why the unit was refused and which units would work', async () => {
      await settleMutation(
        create({
          __typename: 'UnitEligibilityError',
          code: TopLevelErrorCode.UnitInvalid,
          field: 'unitId',
          validUnits: ['g', 'oz'],
          denial: UnitDenial.NoRoute,
        }),
        options,
      );

      expect(alerts()).toEqual([
        [
          t('errors.invalidUnitTitle'),
          t('errors.unitRefusedTryUnits', {
            reason: t('errors.unitDenied.noRoute'),
            units: 'g, oz',
          }),
        ],
      ]);
    });

    it('says what is left, in the unit asked', async () => {
      await settleMutation(
        use({
          __typename: 'InsufficientQuantityError',
          code: ErrorCode.InsufficientQuantity,
          field: 'quantityUsed',
          available: 1.5,
          availableUnitSymbol: 'cup',
        }),
        { document: CreatePantryItemUsageDocument, fallback: FALLBACK },
      );

      expect(alerts()).toEqual([
        [
          t('labels.error'),
          t('errors.onlyAvailable', { amount: '1 1/2', unit: 'cup' }),
        ],
      ]);
    });
  });

  describe('a version conflict', () => {
    it('shows one conflict alert, the same whether it arrives as data or thrown', async () => {
      const withRefresh = { ...options, onConflictRefresh: jest.fn() };
      await settleMutation(
        create({
          __typename: 'ConflictError',
          code: ErrorCode.VersionConflict,
        }),
        withRefresh,
      );
      await settleMutation(
        throwing(graphQLError(ErrorCode.VersionConflict)),
        withRefresh,
      );

      const [asData, thrown] = alerts();
      expect(alerts()).toHaveLength(2);
      expect(asData?.slice(0, 2)).toEqual(thrown?.slice(0, 2));
      expect(asData?.[1]).toBe(getVersionConflictMessage());
    });

    it('offers no Refresh button when the caller has nothing to refresh', async () => {
      await settleMutation(
        create({
          __typename: 'ConflictError',
          code: ErrorCode.VersionConflict,
        }),
        options,
      );
      expect(alerts()).toEqual([
        [
          t('errors.entityUpdatedTitle', { entity: t('labels.item') }),
          getVersionConflictMessage(),
        ],
      ]);
    });

    it("offers the caller's refresh", async () => {
      const onConflictRefresh = jest.fn();
      await settleMutation(
        create({
          __typename: 'ConflictError',
          code: ErrorCode.VersionConflict,
        }),
        { ...options, onConflictRefresh },
      );

      const buttons = alerts()[0]?.[2] as AlertButton[];
      buttons.find(button => button.style !== 'cancel')?.onPress?.();
      expect(onConflictRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('a state conflict', () => {
    // `CONFLICT` refuses on state (already completed, already a member); only
    // the version codes mean the row changed since it was read.
    it('is described by its code, with no refresh offered', async () => {
      const onConflictRefresh = jest.fn();
      const settled = await settleMutation(
        create({ __typename: 'ConflictError', code: ErrorCode.Conflict }),
        { ...options, onConflictRefresh },
      );

      expect(settled.status).toBe('failed');
      expect(alerts()).toEqual([
        [
          t('labels.error'),
          errorService.getUserFriendlyMessage(ErrorCode.Conflict, FALLBACK),
        ],
      ]);
    });
  });

  describe('a failure the server gave no verdict on', () => {
    it("undoes the change and shows the caller's copy", async () => {
      const onFailed = jest.fn();
      const settled = await settleMutation(
        throwing(new NetworkRequestError('Network request failed')),
        { ...options, onFailed },
      );

      expect(settled.status).toBe('failed');
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(alerts()).toEqual([[t('labels.error'), FALLBACK]]);
    });

    it('treats a resolved error as it treats a thrown one', async () => {
      await settleMutation(
        () =>
          Promise.resolve({
            data: undefined,
            error: new Error('Network request failed'),
          }),
        options,
      );
      expect(alerts()).toEqual([[t('labels.error'), FALLBACK]]);
    });
  });

  it("shows a thrown refusal's code copy, not its text", async () => {
    await settleMutation(throwing(graphQLError(ErrorCode.Forbidden)), options);

    const [[, message]] = alerts();
    expect(message).toBe(
      errorService.getUserFriendlyMessage(ErrorCode.Forbidden, FALLBACK),
    );
    expect(message).not.toContain(SERVER_TEXT);
  });

  describe('a committed write whose response also carries an error', () => {
    // Apollo 4.2 resolves `{ data, error }` together when a mutation commits
    // and a field in its selection errors. The payload is the server's verdict.
    const committedWithFieldError = () =>
      Promise.resolve({
        data: { createPantryItem: { __typename: 'CreatePantryItemPayload' } },
        error: graphQLError(TopLevelErrorCode.InternalServerError),
      });

    it('is applied, not reverted', async () => {
      const onFailed = jest.fn();
      const settled = await settleMutation(committedWithFieldError, {
        ...options,
        onFailed,
      });

      expect(settled.status).toBe('applied');
      expect(onFailed).not.toHaveBeenCalled();
      expect(alerts()).toEqual([]);
    });

    it('still fails when the error comes with no usable payload', async () => {
      const settled = await settleMutation(
        () =>
          Promise.resolve({
            data: { createPantryItem: null },
            error: graphQLError(TopLevelErrorCode.InternalServerError),
          }),
        options,
      );

      expect(settled.status).toBe('failed');
    });
  });

  describe('a removal that never reached the service', () => {
    // A bare HTTP 404 — a misrouted endpoint or a proxy — carries no GraphQL
    // verdict, so it cannot mean "the row is already gone".
    const httpNotFound = () =>
      new ServerError('Response not successful', {
        response: new Response('', { status: 404 }),
        bodyText: '',
      });

    it('is not reported as removed', async () => {
      const onFailed = jest.fn();
      const settled = await settleMutation(throwing(httpNotFound()), {
        document: DeletePantryItemDocument,
        fallback: FALLBACK,
        removal: true,
        onFailed,
      });

      expect(settled.status).toBe('failed');
      expect(onFailed).toHaveBeenCalledTimes(1);
    });

    it('still converges when the service itself says it is gone', async () => {
      const settled = await settleMutation(
        remove({ __typename: 'NotFoundError', code: ErrorCode.NotFound }),
        {
          document: DeletePantryItemDocument,
          fallback: FALLBACK,
          removal: true,
        },
      );

      expect(settled.status).toBe('applied');
    });
  });

  describe('settledStatus', () => {
    it('classifies without reporting anything', async () => {
      const read = async (run: () => Promise<{ data?: unknown }>) =>
        settledStatus(await run());

      expect(
        await read(create({ __typename: 'CreatePantryItemPayload' })),
      ).toBe('applied');
      expect(await read(create(null))).toBe('queued');
      expect(await read(create({ __typename: 'ForbiddenError' }))).toBe(
        'failed',
      );
      expect(
        settledStatus(
          await remove({
            __typename: 'NotFoundError',
            code: ErrorCode.NotFound,
          })(),
          { removal: true },
        ),
      ).toBe('applied');
      expect(settledStatus(undefined)).toBe('failed');
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(reportError).not.toHaveBeenCalled();
    });
  });

  describe('presenting a failure', () => {
    it('hands the failure back instead of alerting when asked to', async () => {
      const settled = await settleMutation(
        create({
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'input.quantity',
        }),
        { ...options, present: 'none' },
      );

      expect(alertService.alert).not.toHaveBeenCalled();
      expect(settled.failure).toEqual({
        code: ErrorCode.ValidationFailed,
        field: 'quantity',
        title: t('labels.error'),
        body: t('errors.field.quantity', { defaultValue: FALLBACK }),
      });
    });

    it("uses the caller's copy for a code it names", async () => {
      const copy = { title: 'Already pending', body: 'Wait for review.' };
      await settleMutation(
        create({ __typename: 'ConflictError', code: ErrorCode.Conflict }),
        { ...options, copy: { [ErrorCode.Conflict]: copy } },
      );
      expect(alerts()).toEqual([[copy.title, copy.body]]);
    });

    it("heads a generic failure with the caller's title", async () => {
      await settleMutation(create({ __typename: 'ForbiddenError' }), {
        ...options,
        title: 'Could not report',
      });
      expect(alerts()).toEqual([['Could not report', FALLBACK]]);
    });

    it('tells the user how long a rate limit lasts', async () => {
      const limited = new CombinedGraphQLErrors({
        errors: [
          {
            message: SERVER_TEXT,
            extensions: {
              code: TopLevelErrorCode.OperationRateLimited,
              retryAfter: 120,
            },
          },
        ],
      });
      await settleMutation(throwing(limited), options);

      const [[, message]] = alerts();
      expect(message).not.toContain(SERVER_TEXT);
      expect(message).toBe(t('errors.rateLimitMinutes', { count: 2 }));
    });
  });

  it("labels the report with the document's operation and skips it during a known outage", async () => {
    type StoreState = ReturnType<typeof storeApi.getState>;
    await settleMutation(
      throwing(new NetworkRequestError('Network request failed')),
      options,
    );
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      operation: operationNameOf(CreatePantryItemDocument),
    });

    reportError.mockClear();
    storeApi.setState({
      isOnline: false,
      apiReachable: null,
    } as Partial<StoreState>);
    await settleMutation(
      throwing(new NetworkRequestError('Network request failed')),
      options,
    );
    expect(reportError).not.toHaveBeenCalled();
    storeApi.setState({
      isOnline: true,
      apiReachable: true,
    } as Partial<StoreState>);
  });
});
