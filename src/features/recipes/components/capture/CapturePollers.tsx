import React, { useEffect } from 'react';
import { useRecipeCapturePoll } from '#features/recipes/hooks/useRecipeCapturePoll';
import {
  useCaptureEntries,
  useRecipeCaptureActions,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';

const Poller: React.FC<{ entry: CaptureEntry }> = ({ entry }) => {
  useRecipeCapturePoll(entry);
  return null;
};

/**
 * Polls every capture still reading; renders nothing. Mounted by the Recipes
 * tab, which stays mounted while another tab shows, so an outcome is told
 * wherever the user is.
 */
export const CapturePollers: React.FC = () => {
  const entries = useCaptureEntries();
  const { prune } = useRecipeCaptureActions();
  useEffect(() => {
    prune(Date.now());
  }, [prune]);

  return (
    <>
      {entries
        .filter(entry => entry.state === 'reading')
        .map(entry => (
          <Poller key={entry.id} entry={entry} />
        ))}
    </>
  );
};
