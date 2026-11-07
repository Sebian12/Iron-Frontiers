import type { CountryResources } from './content';

// Trade law and market helpers. A country keeps only the share of resource output that it does
// not export; in exchange it earns foreign currency. Import-based laws export less but let the
// market cover more of a domestic shortfall. Closed markets keep everything and trade nothing.

export type TradeLawId = 'open' | 'semi_open' | 'import_based' | 'closed';

export interface TradeLawDef {
  id: TradeLawId;
  name: string;
  shortName: string;
  icon: string;
  exportShare: number;
  /** Maximum share of a resource need that the market will automatically cover. */
  importCoverage: number;
  importPrice: number;
  description: string;
  highlights: string[];
}

export const TRADE_LAWS: TradeLawDef[] = [
  {
    id: 'open',
    name: 'Open Market',
    shortName: 'Open',
    icon: 'handshake',
    exportShare: 0.75,
    importCoverage: 0.15,
    importPrice: 1.25,
    description: 'Export almost everything and let the world price decide. The treasury benefits, but the domestic economy runs on a quarter of its raw output.',
    highlights: ['75% exported', 'Cheap foreign exchange', 'Limited market imports'],
  },
  {
    id: 'semi_open',
    name: 'Semi-Open Market',
    shortName: 'Semi-open',
    icon: 'exchange',
    exportShare: 0.5,
    importCoverage: 0.3,
    importPrice: 1.5,
    description: 'The pre-war compromise: half of national output is sold abroad and the other half supplies domestic industry. Balanced income and reserves.',
    highlights: ['50% exported', 'Balanced reserves', 'Standard import cover'],
  },
  {
    id: 'import_based',
    name: 'Import-Based Market',
    shortName: 'Import-based',
    icon: 'anchor',
    exportShare: 0.25,
    importCoverage: 0.55,
    importPrice: 1.2,
    description: 'Keep most raw materials at home and rely on imported finished goods and scarce commodities. Lower export earnings, but the widest automatic import cover.',
    highlights: ['25% exported', 'Widest import cover', 'Discounted imports'],
  },
  {
    id: 'closed',
    name: 'Closed Market',
    shortName: 'Closed',
    icon: 'lock',
    exportShare: 0,
    importCoverage: 0,
    importPrice: 0,
    description: 'A siege economy. No resources leave the country and no foreign exchange enters it. Every shortage must be met from domestic output.',
    highlights: ['0% exported', 'Full domestic reserves', 'No imports or trade income'],
  },
];

export function tradeLawById(id: string): TradeLawDef | undefined {
  return TRADE_LAWS.find((law) => law.id === id);
}

/** Approximate daily market value of one unit of each resource, in millions of pounds. */
export const RESOURCE_MARKET_VALUE: Record<keyof CountryResources, number> = {
  steel: 0.03,
  oil: 0.09,
  rubber: 0.06,
  aluminium: 0.05,
  tungsten: 0.12,
  chromium: 0.12,
};

export const TRADE_LAW_CHANGE_COST = 20;
