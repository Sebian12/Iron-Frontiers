import type { CountryResources } from '../sim/content';

export function fmt(value: number, digits = 0): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 1,240,000 → 1.24M, 12,400 → 12.4K. Used where space is tight. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return fmt(Math.round(value));
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signed(value: number, digits = 1): string {
  if (value > 0) return `+${value.toFixed(digits)}`;
  return value.toFixed(digits);
}

export function days(value: number): string {
  return `${Math.max(0, Math.round(value))} ${Math.round(value) === 1 ? 'day' : 'days'}`;
}

export const RESOURCE_INFO: { id: keyof CountryResources; name: string; icon: string }[] = [
  { id: 'steel', name: 'Steel', icon: 'steel' },
  { id: 'oil', name: 'Oil', icon: 'oil' },
  { id: 'rubber', name: 'Rubber', icon: 'rubber' },
  { id: 'aluminium', name: 'Aluminium', icon: 'aluminium' },
  { id: 'tungsten', name: 'Tungsten', icon: 'tungsten' },
  { id: 'chromium', name: 'Chromium', icon: 'chromium' },
];

export function resourceName(id: keyof CountryResources): string {
  return RESOURCE_INFO.find((entry) => entry.id === id)?.name ?? id;
}

export function resourceIcon(id: keyof CountryResources): string {
  return RESOURCE_INFO.find((entry) => entry.id === id)?.icon ?? 'steel';
}

export function relationTone(value: number): 'green' | 'blue' | 'gold' | 'red' {
  if (value >= 40) return 'green';
  if (value >= 5) return 'blue';
  if (value > -30) return 'gold';
  return 'red';
}
