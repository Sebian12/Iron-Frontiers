import type { DivisionDef } from '../sim/content';

export interface DivisionTemplate {
  id: string;
  name: string;
  type: DivisionDef['type'];
  icon: string;
  manpower: number;
  equipment: Record<string, number>;
  attack: number;
  defense: number;
  breakthrough: number;
  speed: number;
  description: string;
}

export const DIVISION_TEMPLATES: DivisionTemplate[] = [
  {
    id: 'infantry',
    name: 'Infantry Division',
    type: 'infantry',
    icon: 'rifle',
    manpower: 9000,
    equipment: { infantry_equipment: 1000, support_equipment: 120 },
    attack: 22,
    defense: 58,
    breakthrough: 12,
    speed: 4,
    description: 'Nine battalions of riflemen with divisional artillery and a signals company. The backbone of any army.',
  },
  {
    id: 'motorized',
    name: 'Motorised Division',
    type: 'motorized',
    icon: 'truck',
    manpower: 8500,
    equipment: { infantry_equipment: 900, truck: 220, support_equipment: 100 },
    attack: 26,
    defense: 44,
    breakthrough: 24,
    speed: 8,
    description: 'Infantry carried in lorries, able to follow armour and hold the ground it takes.',
  },
  {
    id: 'armor',
    name: 'Armoured Division',
    type: 'armor',
    icon: 'tank',
    manpower: 7000,
    equipment: { medium_tank: 180, infantry_equipment: 400, truck: 120, support_equipment: 80 },
    attack: 44,
    defense: 36,
    breakthrough: 62,
    speed: 7,
    description: 'Concentrated armour with motorised infantry and mobile artillery for exploitation.',
  },
  {
    id: 'cavalry',
    name: 'Cavalry Division',
    type: 'cavalry',
    icon: 'helmet',
    manpower: 7500,
    equipment: { infantry_equipment: 850, support_equipment: 60 },
    attack: 18,
    defense: 34,
    breakthrough: 10,
    speed: 6,
    description: 'Mounted troops for screening, pursuit and frontier patrol. Cheap, fast and fragile.',
  },
  {
    id: 'mountaineer',
    name: 'Mountain Division',
    type: 'mountaineer',
    icon: 'mountain',
    manpower: 8200,
    equipment: { infantry_equipment: 900, support_equipment: 140 },
    attack: 26,
    defense: 52,
    breakthrough: 16,
    speed: 4,
    description: 'Specialist troops with pack transport and mountain artillery for broken terrain.',
  },
  {
    id: 'marine',
    name: 'Marine Division',
    type: 'marine',
    icon: 'anchor',
    manpower: 8400,
    equipment: { infantry_equipment: 950, support_equipment: 150 },
    attack: 28,
    defense: 46,
    breakthrough: 20,
    speed: 4,
    description: 'Amphibious assault troops trained for beachheads and river crossings.',
  },
];

export function divisionTemplate(id: string): DivisionTemplate | undefined {
  return DIVISION_TEMPLATES.find((entry) => entry.id === id);
}
