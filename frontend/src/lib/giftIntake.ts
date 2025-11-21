import type { IntakeSummary } from '@/types/gift';
import type { PreferenceAxis, PreferenceMap } from '@/types/preferences';

const stringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((item): item is string => typeof item === 'string');
  return filtered.length > 0 ? filtered : undefined;
};

const toCleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parsePreferenceMap = (value: unknown): PreferenceMap | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  const axesRaw = (obj.axes ?? obj.items ?? null) as unknown;
  if (!Array.isArray(axesRaw)) {
    return undefined;
  }
  const axes: PreferenceAxis[] = axesRaw
    .map((axis) => {
      if (!axis || typeof axis !== 'object') {
        return null;
      }
      const record = axis as Record<string, unknown>;
      const label = toCleanString(record.label ?? record.name ?? record.key);
      const level =
        typeof record.level === 'number'
          ? record.level
          : typeof record.score === 'number'
            ? record.score
            : null;
      if (!label || level == null || Number.isNaN(level)) {
        return null;
      }
      const clamped = Math.max(1, Math.min(5, Math.round(level)));
      const key = toCleanString(record.key ?? label) ?? label;
      const evidence = toCleanString(record.evidence ?? record.reason ?? record.note) ?? null;
      return {
        key,
        label,
        level: clamped,
        evidence,
      };
    })
    .filter((axis): axis is PreferenceAxis => Boolean(axis));

  if (axes.length < 3) {
    return undefined;
  }

  const title = toCleanString(obj.title ?? obj.heading ?? obj.label) ?? null;
  const summary = toCleanString(obj.summary) ?? null;
  const notes = toCleanString(obj.notes ?? obj.memo) ?? null;

  return {
    title,
    axes,
    summary,
    notes,
  };
};

export function normalizeIntakeSummary(data: unknown): IntakeSummary | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const summary: IntakeSummary = {};

  const aroma = stringArray(record.aroma);
  if (aroma) summary.aroma = aroma;

  const taste = stringArray(record.taste_profile);
  if (taste) summary.taste_profile = taste;

  if (typeof record.sweetness_dryness === 'string') {
    summary.sweetness_dryness = record.sweetness_dryness;
  }

  const temperature = stringArray(record.temperature_preference);
  if (temperature) summary.temperature_preference = temperature;

  const foodPairing = stringArray(record.food_pairing);
  if (foodPairing) summary.food_pairing = foodPairing;

  if (typeof record.drinking_frequency === 'string') {
    summary.drinking_frequency = record.drinking_frequency;
  }

  const region = stringArray(record.region_preference);
  if (region) summary.region_preference = region;

  if (typeof record.notes === 'string' && record.notes.trim()) {
    summary.notes = record.notes;
  }

  const preferenceMap = parsePreferenceMap(
    record.preference_map ?? record.taste_map ?? record.tendency_map ?? null,
  );
  if (preferenceMap) {
    summary.preference_map = preferenceMap;
  }

  return Object.keys(summary).length > 0 ? summary : null;
}

export function summarizeIntake(summary: IntakeSummary | null): string[] {
  if (!summary) return [];
  const lines: string[] = [];
  if (summary.preference_map?.axes?.length) {
    const axisLabels = summary.preference_map.axes
      .slice(0, 4)
      .map((axis) => `${axis.label}=${axis.level}`)
      .join(' / ');
    lines.push(`嗜好マップ: ${axisLabels}`);
    if (summary.preference_map.summary) {
      lines.push(summary.preference_map.summary);
    }
  }
  if (summary.sweetness_dryness) {
    lines.push(`味わい: ${summary.sweetness_dryness}`);
  }
  if (summary.aroma?.length) {
    lines.push(`香り: ${summary.aroma.join(' / ')}`);
  }
  if (summary.temperature_preference?.length) {
    lines.push(`温度: ${summary.temperature_preference.join(' / ')}`);
  }
  if (summary.food_pairing?.length) {
    lines.push(`料理: ${summary.food_pairing.join(' / ')}`);
  }
  if (summary.drinking_frequency) {
    lines.push(`頻度: ${summary.drinking_frequency}`);
  }
  if (summary.region_preference?.length) {
    lines.push(`地域: ${summary.region_preference.join(' / ')}`);
  }
  if (summary.notes) {
    lines.push(summary.notes);
  }
  return lines;
}
