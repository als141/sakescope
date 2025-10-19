export type TextWorkerProgressEventType =
  | 'status'
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'reasoning'
  | 'message'
  | 'final'
  | 'error';

export interface TextWorkerProgressEvent {
  type: TextWorkerProgressEventType;
  /**
   * Human readable label to show in UI (e.g. "web_search 呼び出し中").
   */
  label?: string;
  /**
   * Optional descriptive message or reasoning snippet.
   */
  message?: string;
  /**
   * Optional name of the tool that triggered the event.
   */
  toolName?: string;
  /**
   * Optional structured data payload for debugging/telemetry.
   */
  data?: Record<string, unknown>;
  /**
   * ISO timestamp representing when the event was emitted.
   */
  timestamp: string;
}

export type TextWorkerProgressListener = (event: TextWorkerProgressEvent) => void;
