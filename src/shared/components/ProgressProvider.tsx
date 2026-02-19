import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ProgressJobType = 'import_customers' | 'delete_customers';

export interface ProgressState {
  id: string;
  type: ProgressJobType;
  title: string;
  message?: string;
  current: number;
  total: number;
  indeterminate?: boolean;
  startedAt: number;
}

interface StartProgressInput {
  type: ProgressJobType;
  title: string;
  message?: string;
  current?: number;
  total?: number;
  indeterminate?: boolean;
}

interface ProgressContextValue {
  activeProgress: ProgressState | null;
  startProgress: (job: StartProgressInput) => string;
  updateProgress: (id: string, patch: Partial<Pick<ProgressState, 'current' | 'total' | 'message' | 'indeterminate'>>) => void;
  finishProgress: (id: string) => void;
  clearProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProgress, setActiveProgress] = useState<ProgressState | null>(null);

  const startProgress = useCallback((job: StartProgressInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setActiveProgress({
      id,
      type: job.type,
      title: job.title,
      message: job.message,
      current: job.current ?? 0,
      total: job.total ?? 0,
      indeterminate: job.indeterminate ?? false,
      startedAt: Date.now()
    });
    return id;
  }, []);

  const updateProgress = useCallback((id: string, patch: Partial<Pick<ProgressState, 'current' | 'total' | 'message' | 'indeterminate'>>) => {
    setActiveProgress(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const finishProgress = useCallback((id: string) => {
    setActiveProgress(prev => (prev && prev.id === id ? null : prev));
  }, []);

  const clearProgress = useCallback(() => {
    setActiveProgress(null);
  }, []);

  const value = useMemo(
    () => ({ activeProgress, startProgress, updateProgress, finishProgress, clearProgress }),
    [activeProgress, startProgress, updateProgress, finishProgress, clearProgress]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
};

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return ctx;
};

