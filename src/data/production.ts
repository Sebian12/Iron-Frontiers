import type { CountryResources } from '../sim/content';

// Equipment that production lines can build. `cost` is industrial cost per unit, the resource
// requirement is charged per factory assigned to the line each day.

export type EquipmentCategory = 'Infantry' | 'Artillery' | 'Armour' | 'Motorised' | 'Air' | 'Naval';

export interface EquipmentDef {
  id: string;
  name: string;
  category: EquipmentCategory;
  icon: string;
  cost: number;
  needs: Partial<CountryResources>;
  description: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  {
    id: 'infantry_equipment',
    name: 'Infantry Equipment',
    category: 'Infantry',
    icon: 'rifle',
    cost: 0.5,
    needs: { steel: 1 },
    description: 'Rifles, machine guns, helmets and personal kit for line infantry.',
  },
  {
    id: 'support_equipment',
    name: 'Support Equipment',
    category: 'Infantry',
    icon: 'gear',
    cost: 3,
    needs: { steel: 1, tungsten: 1 },
    description: 'Signals sets, mortars, engineers’ tools and medical stores.',
  },
  {
    id: 'artillery',
    name: 'Artillery',
    category: 'Artillery',
    icon: 'artillery',
    cost: 8,
    needs: { steel: 2, tungsten: 1 },
    description: 'Towed field guns and their caissons for divisional artillery.',
  },
  {
    id: 'anti_tank',
    name: 'Anti-Tank Guns',
    category: 'Artillery',
    icon: 'artillery',
    cost: 9,
    needs: { steel: 2, tungsten: 2 },
    description: 'High-velocity guns for anti-armour defence.',
  },
  {
    id: 'light_tank',
    name: 'Light Tank',
    category: 'Armour',
    icon: 'tank',
    cost: 14,
    needs: { steel: 3, oil: 1 },
    description: 'Fast, lightly armoured vehicles for reconnaissance and exploitation.',
  },
  {
    id: 'medium_tank',
    name: 'Medium Tank',
    category: 'Armour',
    icon: 'tank',
    cost: 24,
    needs: { steel: 5, tungsten: 1, oil: 2 },
    description: 'The mainstay of armoured divisions: balanced armour, gun and mobility.',
  },
  {
    id: 'truck',
    name: 'Motorised Transport',
    category: 'Motorised',
    icon: 'truck',
    cost: 5,
    needs: { steel: 2, rubber: 2 },
    description: 'Lorries for motorised infantry and supply columns.',
  },
  {
    id: 'fighter',
    name: 'Fighter Aircraft',
    category: 'Air',
    icon: 'fighter',
    cost: 28,
    needs: { aluminium: 4, rubber: 2 },
    description: 'Single-engine interceptors for air superiority.',
  },
  {
    id: 'cas',
    name: 'Close Air Support',
    category: 'Air',
    icon: 'bomber',
    cost: 32,
    needs: { aluminium: 5, rubber: 2 },
    description: 'Ground-attack aircraft that support divisions in contact.',
  },
  {
    id: 'submarine',
    name: 'Submarine',
    category: 'Naval',
    icon: 'submarine',
    cost: 42,
    needs: { steel: 8, tungsten: 2 },
    description: 'Long-range boats for convoy raiding.',
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    category: 'Naval',
    icon: 'warship',
    cost: 60,
    needs: { steel: 10, tungsten: 2 },
    description: 'Escort and screening vessel for the battle fleet.',
  },
];

export interface ProductionLineState {
  id: number;
  equipmentId: string;
  factories: number;
  efficiency: number; // 0..1
  progress: number; // accumulated industrial cost on the current unit
  produced: number;
  paused: boolean;
}

export interface ConstructionState {
  id: number;
  buildingId: string;
  cost: number;
  progress: number;
  count: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
  effect: string;
  resource: 'civilianFactories' | 'militaryFactories' | 'dockyards' | 'infrastructure';
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'civilian_factory',
    name: 'Civilian Factory',
    icon: 'factory',
    cost: 5400,
    description: 'Construction and consumer industry, the engine of national growth.',
    effect: '+1 civilian factory',
    resource: 'civilianFactories',
  },
  {
    id: 'military_factory',
    name: 'Military Factory',
    icon: 'factory',
    cost: 5400,
    description: 'Arms plants that equip the field army.',
    effect: '+1 military factory',
    resource: 'militaryFactories',
  },
  {
    id: 'dockyard',
    name: 'Dockyard',
    icon: 'anchor',
    cost: 4200,
    description: 'Slipways for hulls and escorts.',
    effect: '+1 dockyard',
    resource: 'dockyards',
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    icon: 'crane',
    cost: 3000,
    description: 'Roads, rail and power for the provinces behind the front.',
    effect: '+1 infrastructure',
    resource: 'infrastructure',
  },
  {
    id: 'anti_air',
    name: 'Anti-Air Battery',
    icon: 'radar',
    cost: 3600,
    description: 'Static heavy anti-aircraft defences for industrial centres.',
    effect: '+8% air defence',
    resource: 'civilianFactories',
  },
];

export function equipmentById(id: string): EquipmentDef | undefined {
  return EQUIPMENT.find((entry) => entry.id === id);
}

export function buildingById(id: string): BuildingDef | undefined {
  return BUILDINGS.find((entry) => entry.id === id);
}
