import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {PendingAction} from '../types';

export interface OfflineState {
  queue: PendingAction[];
  enqueue: (action: PendingAction) => void;
  dequeue: () => PendingAction | undefined;
  clearQueue: () => void;
  syncQueue: () => Promise<void>;
}

export const createOfflineSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  OfflineState
> = (set, get) => ({
  queue: [],

  enqueue: action =>
    set(state => {
      state.queue.push(action);
    }),

  dequeue: () => {
    const action = get().queue.shift();
    set(state => {
      state.queue = get().queue;
    });
    return action;
  },

  clearQueue: () => set({queue: []}),

  syncQueue: async () => {
    let action = get().dequeue();
    while (action) {
      try {
        await action.execute();
      } catch (err) {
        console.error('Failed to sync action', err);
      }
      action = get().dequeue();
    }
  },
});
