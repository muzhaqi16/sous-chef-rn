import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { ItemList } from '#components/organisms/ItemList';
import { Button } from '#components/molecules/Button';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useReceiptFlowExits } from './receiptFlowExits';
import { toastService } from '#/services/toastService';
import { ReceiptLineSheet } from '../components/ReceiptLineSheet';
import { ReceiptReviewHeader } from '../components/ReceiptReviewHeader';
import { useReceiptReviewItems } from '../components/useReceiptReviewItems';
import { useReceiptReview } from '../hooks/useReceiptReview';
import { receiptsTestIDs } from '../testIDs';

export const ReceiptReviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const { toPantryMain } = useAppNavigation();
  const exits = useReceiptFlowExits();
  const review = useReceiptReview();
  const {
    rows,
    merchant,
    store,
    proposedStoreName,
    storeUnrecognized,
    matchState,
    pantryName,
    pendingCount,
    recordedCount,
    applying,
    listLoading,
    chooseLine,
    listItemNameFor,
    pickItem,
    addChosen,
    finish,
  } = review;

  // The draft is cleared once the screen has gone: cleared first, the review
  // shows its "no items" state while it slides away. Once, however often the
  // draft changes while it is open.
  const applied = useRef(false);
  const leave = useEffectEvent(() => {
    if (applied.current) finish();
  });
  useEffect(() => () => leave(), []);

  // What was read shows as text that opens its field; what wasn't is a field.
  const [changingStore, setChangingStore] = useState(false);
  // What the user types to search; a store is only what they pick.
  const [storeText, setStoreText] = useState<string | null>(null);
  const storeTitle = store?.name ?? proposedStoreName ?? merchant;
  const showStore = storeUnrecognized || changingStore;
  const toggleStore = () => setChangingStore(open => !open);

  // Kept after closing, so the sheet animates out full.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [opening, setOpening] = useState(0);
  const editing = rows.find(row => row.index === editingIndex);
  const openLine = (id: string) => {
    const row = rows.find(candidate => String(candidate.index) === id);
    if (!row || row.status === 'added' || row.status === 'queued') return;
    setEditingIndex(row.index);
    setOpening(count => count + 1);
    setSheetVisible(true);
  };
  const closeSheet = () => {
    setSheetVisible(false);
    pickItem(null);
  };

  const items = useReceiptReviewItems(rows, matchState === 'failed');

  const addedMessage = (count: number, recorded: number) => {
    if (count === 0) {
      return t('receipts.review.recordedOnly', { count: recorded });
    }
    if (recorded === 0) {
      return pantryName
        ? t('receipts.review.addedTo', { count, pantry: pantryName })
        : t('receipts.review.addedCount', { count });
    }
    return pantryName
      ? t('receipts.review.addedToMixed', {
          count,
          pantry: pantryName,
          recorded,
        })
      : t('receipts.review.addedCountMixed', { count, recorded });
  };

  const leaveReview = () => {
    applied.current = true;
    if (exits) exits.finished();
    else toPantryMain();
  };

  // The check-in runs on without the review: its lines are in the pantry now.
  const handleAdd = async () => {
    const { sent, recorded, held, learned, stocked } = await addChosen();
    if (sent > 0) toastService.success(addedMessage(sent - recorded, recorded));
    // Counted once answered: a refused line is back to add, and adds again.
    void stocked.then(count => {
      if (count > 0) exits?.added(count);
    });
    // An info toast queues behind the items' success toast; its Undo outlives
    // this screen, which the review leaves at once.
    void learned.then(newStore => {
      if (!newStore) return;
      toastService.info(
        t('receipts.review.storeLearned', { store: newStore.name }),
        {
          action: {
            label: t('labels.undo'),
            onPress: () => {
              void newStore.undo();
            },
          },
        },
      );
    });
    // A line that still lacks something keeps the review, saying which; so do
    // lines still waiting for a match, to add once matched, and lines with no
    // product, which only the user may let go.
    const open = rows.some(
      row => row.status === 'pending' || row.status === 'unmatched',
    );
    if (held > 0 || open) return;
    leaveReview();
  };

  const addLabel = () => {
    if (pendingCount === 0) return t('receipts.review.addNone');
    if (recordedCount === 0) {
      return t('receipts.review.add', { count: pendingCount });
    }
    return recordedCount === pendingCount
      ? t('receipts.review.recordOnly', { count: recordedCount })
      : t('receipts.review.addMixed', {
          count: pendingCount - recordedCount,
          recorded: recordedCount,
        });
  };

  // Lines nobody has decided on, a match that could not run among them.
  const openCount = rows.filter(
    row =>
      row.status === 'unmatched' ||
      (row.status === 'pending' && matchState === 'failed'),
  ).length;
  const stillMatching =
    matchState !== 'failed' && rows.some(row => row.status === 'pending');
  // Offered once something went in: before that, nothing would be finished.
  const canFinish =
    pendingCount === 0 &&
    !stillMatching &&
    rows.some(row => row.status === 'added' || row.status === 'queued');

  const footer =
    rows.length === 0 ? undefined : canFinish ? (
      <Button
        onPress={leaveReview}
        icon="checkmark-circle-outline"
        testID={receiptsTestIDs.reviewFinish}
      >
        {openCount > 0
          ? t('receipts.review.finishOpen', { count: openCount })
          : t('labels.done')}
      </Button>
    ) : (
      <Button
        onPress={() => {
          void handleAdd();
        }}
        disabled={pendingCount === 0}
        loading={applying || listLoading}
        icon="add-circle-outline"
        testID={receiptsTestIDs.reviewAdd}
      >
        {addLabel()}
      </Button>
    );

  return (
    <SubScreen
      title={storeTitle ?? t('receipts.review.title')}
      {...(storeTitle && !storeUnrecognized
        ? { switchable: { onPress: toggleStore, open: changingStore } }
        : {})}
      scroll="list"
      footer={footer}
      testID={receiptsTestIDs.reviewScreen}
    >
      <ItemList
        items={items}
        onItemPress={openLine}
        testIDPrefix={receiptsTestIDs.reviewLine}
        ListHeaderComponent={
          rows.length > 0 ? (
            <ReceiptReviewHeader
              review={review}
              storeOpen={showStore}
              onToggleStore={toggleStore}
              storeText={storeText}
              onStoreTextChange={setStoreText}
            />
          ) : null
        }
        emptyState={{
          icon: 'receipt-outline',
          title: t('receipts.review.emptyTitle'),
          description: t('receipts.review.emptyBody'),
        }}
      />
      <ReceiptLineSheet
        visible={sheetVisible}
        line={editing ?? null}
        choice={editing?.choice}
        asked={editing?.asked}
        canLeaveOut={editing?.status !== 'skipped'}
        candidates={editing?.candidates ?? []}
        refusal={
          editing?.status === 'failed' && editing.failure
            ? { message: editing.failure, on: editing.failedOn }
            : undefined
        }
        listItemNameFor={key =>
          editing ? listItemNameFor(editing.index, key) : undefined
        }
        onPickItem={pickItem}
        opening={opening}
        onClose={closeSheet}
        onSave={choice => {
          if (editing) chooseLine(editing.index, choice);
        }}
        onRemove={() => {
          if (editing) chooseLine(editing.index, null);
          closeSheet();
        }}
      />
    </SubScreen>
  );
};
