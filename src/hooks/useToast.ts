import { createContext, useContext } from 'react';
import { ToastFn } from '../components/atoms/Toast';

export const ToastContext = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastContext);
