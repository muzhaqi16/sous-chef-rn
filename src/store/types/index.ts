export type PendingAction = {
  execute: () => Promise<any>;
  // …plus whatever metadata you need (mutation name, payload, etc.)
};
