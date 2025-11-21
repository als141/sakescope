export interface PreferenceAxis {
  /**
   * Stable key (snake/kebab/camel OK) used to identify the axis.
   */
  key: string;
  /**
   * Human readable label (e.g., "甘さ", "華やかさ", "珍しさ").
   */
  label: string;
  /**
   * 1–5 scale where 5 is strongest preference or intensity.
   */
  level: number;
  /**
   * Optional short reasoning or evidence pulled from the conversation.
   */
  evidence?: string | null;
}

export interface PreferenceMap {
  /**
   * Title or short descriptor (optional).
   */
  title?: string | null;
  /**
   * 3–6 axes describing the user's taste tendencies.
   */
  axes: PreferenceAxis[];
  /**
   * One‑line summary highlighting overall tendency.
   */
  summary?: string | null;
  notes?: string | null;
}
