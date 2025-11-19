import type { IntakeSummary } from '@/types/gift';

const stringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((item): item is string => typeof item === 'string');
  return filtered.length > 0 ? filtered : undefined;
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

  return Object.keys(summary).length > 0 ? summary : null;
}

export function summarizeIntake(summary: IntakeSummary | null): string[] {
  if (!summary) return [];
  const lines: string[] = [];
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
