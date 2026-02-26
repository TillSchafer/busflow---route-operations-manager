import {
  type LoadingDisplayState,
  type LoadingEngineOptions,
  type LoadingEngineSnapshot,
  type LoadingProgress,
  type LoadingScope,
  type LoadingStartOptions,
  type LoadingToken,
  type LoadingUpdatePatch
} from './loading-types';

interface LoadingOperation {
  token: LoadingToken;
  scope: LoadingScope;
  startedAtMs: number;
  message?: string;
  progress?: LoadingProgress;
}

const DEFAULT_REVEAL_DELAY_MS = 150;
const DEFAULT_RAPID_RESUME_WINDOW_MS = 800;
const DEFAULT_SHORT_VARIANT_THRESHOLD_MS = 850;
const DEFAULT_MESSAGE = 'Lade...';

const createToken = (): LoadingToken => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export class LoadingEngine {
  private readonly operations = new Map<LoadingToken, LoadingOperation>();
  private readonly listeners = new Set<() => void>();
  private readonly revealDelayMs: number;
  private readonly rapidResumeWindowMs: number;
  private readonly shortVariantThresholdMs: number;
  private readonly defaultMessage: string;
  private readonly now: () => number;

  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReveal = false;
  private visibleSinceMs: number | null = null;
  private lastSettledAtMs: number | null = null;
  private snapshot: LoadingEngineSnapshot;

  constructor(options: LoadingEngineOptions = {}) {
    this.revealDelayMs = options.revealDelayMs ?? DEFAULT_REVEAL_DELAY_MS;
    this.rapidResumeWindowMs = options.rapidResumeWindowMs ?? DEFAULT_RAPID_RESUME_WINDOW_MS;
    this.shortVariantThresholdMs = options.shortVariantThresholdMs ?? DEFAULT_SHORT_VARIANT_THRESHOLD_MS;
    this.defaultMessage = options.defaultMessage ?? DEFAULT_MESSAGE;
    this.now = options.now ?? (() => Date.now());
    this.snapshot = this.buildSnapshot();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): LoadingEngineSnapshot {
    return this.snapshot;
  }

  private buildSnapshot(): LoadingEngineSnapshot {
    const display = this.getDisplayState();
    return {
      activeCount: this.operations.size,
      isActive: this.operations.size > 0,
      shouldReveal: this.shouldReveal,
      visibleSinceMs: this.visibleSinceMs,
      lastSettledAtMs: this.lastSettledAtMs,
      revealDelayMs: this.revealDelayMs,
      shortVariantThresholdMs: this.shortVariantThresholdMs,
      display
    };
  }

  start(options: LoadingStartOptions = {}): LoadingToken {
    const token = createToken();
    const startedAtMs = this.now();

    this.operations.set(token, {
      token,
      scope: options.scope ?? 'system',
      startedAtMs,
      message: options.message,
      progress: options.progress
    });

    if (this.operations.size === 1) {
      this.beginRevealCycle(startedAtMs);
    }

    this.emit();
    return token;
  }

  update(token: LoadingToken, patch: LoadingUpdatePatch): boolean {
    const operation = this.operations.get(token);
    if (!operation) {
      return false;
    }

    this.operations.set(token, {
      ...operation,
      ...patch
    });
    this.emit();
    return true;
  }

  stop(token: LoadingToken): boolean {
    const existed = this.operations.delete(token);
    if (!existed) {
      return false;
    }

    if (this.operations.size === 0) {
      this.finishRevealCycle();
    }

    this.emit();
    return true;
  }

  async runWithLoading<T>(operation: () => Promise<T> | T, options: LoadingStartOptions = {}): Promise<T> {
    const token = this.start(options);
    try {
      return await operation();
    } finally {
      this.stop(token);
    }
  }

  private beginRevealCycle(nowMs: number): void {
    this.clearRevealTimer();

    const shouldResumeImmediately =
      this.lastSettledAtMs !== null && nowMs - this.lastSettledAtMs <= this.rapidResumeWindowMs;

    if (shouldResumeImmediately) {
      this.shouldReveal = true;
      if (this.visibleSinceMs === null) {
        this.visibleSinceMs = nowMs;
      }
      return;
    }

    this.shouldReveal = false;
    this.visibleSinceMs = null;
    this.revealTimer = setTimeout(() => {
      if (this.operations.size === 0) {
        return;
      }
      this.shouldReveal = true;
      if (this.visibleSinceMs === null) {
        this.visibleSinceMs = this.now();
      }
      this.emit();
    }, this.revealDelayMs);
  }

  private finishRevealCycle(): void {
    this.clearRevealTimer();
    this.shouldReveal = false;
    this.visibleSinceMs = null;
    this.lastSettledAtMs = this.now();
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  private getDisplayState(): LoadingDisplayState {
    if (this.operations.size === 0) {
      return {
        scope: 'system',
        message: this.defaultMessage
      };
    }

    const currentOperation = Array.from(this.operations.values()).sort((a, b) => b.startedAtMs - a.startedAtMs)[0];
    return {
      scope: currentOperation.scope,
      message: currentOperation.message?.trim() || this.defaultMessage,
      progress: currentOperation.progress
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }
}
