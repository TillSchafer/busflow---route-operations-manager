import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastInput {
  type: ToastType;
  title: string;
  message: string;
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_TOASTS = 3;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      window.clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    Object.values(timersRef.current).forEach(timer => window.clearTimeout(timer));
    timersRef.current = {};
    setToasts([]);
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: ToastItem = { ...toast, id };

    setToasts(prev => [item, ...prev].slice(0, MAX_TOASTS));

    const duration =
      typeof toast.durationMs === 'number'
        ? toast.durationMs
        : toast.type === 'error'
          ? 5000
          : 3500;

    timersRef.current[id] = window.setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      removeToast,
      clearToasts
    }),
    [toasts, pushToast, removeToast, clearToasts]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return { pushToast: ctx.pushToast, clearToasts: ctx.clearToasts };
};

export const useToastStore = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastStore must be used within ToastProvider');
  }
  return { toasts: ctx.toasts, removeToast: ctx.removeToast };
};
