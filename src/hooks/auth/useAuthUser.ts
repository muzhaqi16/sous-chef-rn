import { useAppStore, selectUser } from '#store/useAppStore';

export const useAuthUser = () => useAppStore(selectUser);
