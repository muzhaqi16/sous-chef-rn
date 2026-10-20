import { gql, type TypedDocumentNode } from '@apollo/client';
import { useFragment } from '@apollo/client/react';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { Telemetry } from '#/services/telemetry';
import { useIncompleteCellReport } from '../useIncompleteCellReport';

type Batch = {
  __typename: 'PantryItemBatch';
  id: string;
  batchNumber: number;
  notes: string | null;
};

const CELL: TypedDocumentNode<Batch> = gql`
  fragment UseIncompleteCellReportTest_batch on PantryItemBatch {
    id
    batchNumber
    notes
  }
`;

const WITHOUT_NOTES: TypedDocumentNode<Omit<Batch, 'notes'>> = gql`
  fragment UseIncompleteCellReportTest_listed on PantryItemBatch {
    id
    batchNumber
  }
`;

/** A cell's read by id, reported under `name`. */
function useCell(id: string, name: string): boolean {
  const { complete, missing } = useFragment({
    fragment: CELL,
    fragmentName: 'UseIncompleteCellReportTest_batch',
    from: { __typename: 'PantryItemBatch', id },
  });
  useIncompleteCellReport(name, missing);
  return complete;
}

const seeded = (withNotes: boolean) =>
  seedCache([
    withNotes
      ? {
          data: {
            __typename: 'PantryItemBatch',
            id: 'b1',
            batchNumber: 1,
            notes: null,
          },
          fragment: CELL,
          fragmentName: 'UseIncompleteCellReportTest_batch',
        }
      : {
          data: { __typename: 'PantryItemBatch', id: 'b1', batchNumber: 1 },
          fragment: WITHOUT_NOTES,
          fragmentName: 'UseIncompleteCellReportTest_listed',
        },
  ]);

describe('useIncompleteCellReport', () => {
  beforeEach(() => {
    jest.mocked(Telemetry.warn).mockClear();
  });

  it('reports a cached entity missing a field the cell reads', () => {
    const { result } = renderHookWithApollo(() => useCell('b1', 'partial'), {
      cache: seeded(false),
    });

    expect(result.current).toBe(false);
    expect(Telemetry.warn).toHaveBeenCalledTimes(1);
    expect(Telemetry.warn).toHaveBeenCalledWith(expect.any(String), {
      fragment: 'partial',
      fields: 'notes',
    });
  });

  it('does not report a row that is not cached at all', () => {
    const { result } = renderHookWithApollo(() => useCell('gone', 'absent'), {
      cache: seeded(true),
    });

    expect(result.current).toBe(false);
    expect(Telemetry.warn).not.toHaveBeenCalled();
  });

  it('does not report a complete read', () => {
    const { result } = renderHookWithApollo(() => useCell('b1', 'complete'), {
      cache: seeded(true),
    });

    expect(result.current).toBe(true);
    expect(Telemetry.warn).not.toHaveBeenCalled();
  });

  it('reports a fragment once, however many cells read it', () => {
    const cache = seeded(false);
    renderHookWithApollo(() => useCell('b1', 'once'), { cache });
    renderHookWithApollo(() => useCell('b1', 'once'), { cache });

    expect(Telemetry.warn).toHaveBeenCalledTimes(1);
  });
});
