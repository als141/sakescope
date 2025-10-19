import {
  TextWorkerProgressEvent,
  TextWorkerProgressListener,
} from '@/types/textWorker';

const HISTORY_LIMIT = 50;

const listeners = new Map<string, Set<TextWorkerProgressListener>>();
const history = new Map<string, TextWorkerProgressEvent[]>();

const ensureTimestamp = (
  event: Omit<TextWorkerProgressEvent, 'timestamp'> & { timestamp?: string },
): TextWorkerProgressEvent => ({
  ...event,
  timestamp: event.timestamp ?? new Date().toISOString(),
});

export function publishProgress(
  runId: string | null | undefined,
  event: Omit<TextWorkerProgressEvent, 'timestamp'> & { timestamp?: string },
): void {
  if (!runId) {
    return;
  }
  const payload = ensureTimestamp(event);

  const queue = history.get(runId) ?? [];
  queue.push(payload);
  if (queue.length > HISTORY_LIMIT) {
    queue.splice(0, queue.length - HISTORY_LIMIT);
  }
  history.set(runId, queue);

  const runListeners = listeners.get(runId);
  if (!runListeners || runListeners.size === 0) {
    return;
  }

  for (const listener of runListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.warn('[TextWorkerProgress] Listener error:', error);
    }
  }
}

export function subscribeProgress(
  runId: string,
  listener: TextWorkerProgressListener,
): () => void {
  const existing = listeners.get(runId);
  if (existing) {
    existing.add(listener);
  } else {
    listeners.set(runId, new Set([listener]));
  }

  const stored = history.get(runId);
  if (stored && stored.length > 0) {
    for (const event of stored) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[TextWorkerProgress] History replay failed:', error);
        break;
      }
    }
  }

  return () => {
    const runListeners = listeners.get(runId);
    if (!runListeners) {
      return;
    }
    runListeners.delete(listener);
    if (runListeners.size === 0) {
      listeners.delete(runId);
    }
  };
}

export function clearProgress(runId: string | null | undefined): void {
  if (!runId) {
    return;
  }
  listeners.delete(runId);
  history.delete(runId);
}
