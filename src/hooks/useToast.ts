import { createContext, useContext } from 'react';
import type { ToastFn } from '../components/atoms/Toast';

export const ToastContext = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastContext);
