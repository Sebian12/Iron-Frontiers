import type { BuildingDef } from '../data/production';
import type { Province } from './world';
import { terrainDef } from './terrain';

// Per-province development. The national counters remain the sum used by the economy screen,
// while this record answers the HOI4-style question: what is built in this province, and how
// much room is left?

export interface ProvinceDevelopment {
  infrastructure: number;
  buildings: Record<string, number>;
}

export function createDevelopment(): ProvinceDevelopment {
  return { infrastructure: 0, buildings: {} };
}

/** Buildings other than infrastructure occupy one slot each. */
export function usedSlots(development: ProvinceDevelopment): number {
  return Object.values(development.buildings).reduce((sum, count) => sum + Math.max(0, count), 0);
}

export function provinceSlots(province: Province, development: ProvinceDevelopment): number {
  return terrainDef(province.terrain).baseSlots + Math.max(0, development.infrastructure);
}

export function provinceBuildCost(building: BuildingDef, province: Province): number {
  return Math.round(building.cost * terrainDef(province.terrain).buildCost);
}

/** Infrastructure shortens the work; terrain difficulty is already reflected in the cost. */
export function provinceBuildSpeed(development: ProvinceDevelopment): number {
  return 1 + Math.max(0, development.infrastructure) * 0.08;
}

export function buildingCount(development: ProvinceDevelopment, buildingId: string): number {
  return Math.max(0, Math.floor(development.buildings[buildingId] ?? 0));
}
